"""Report a listing: public create, rate limit, admin list and delete."""

import uuid
from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import func, select, text

from app.models import Provider, ProviderReport
from tests.conftest import ADMIN_HEADERS, make_category, make_provider

ADMIN_URL = "/api/v1/admin/reports"


def reports_url(provider_id) -> str:
    return f"/api/v1/providers/{provider_id}/reports"


def count_reports(db) -> int:
    return db.scalar(select(func.count()).select_from(ProviderReport))


def make_report(db, provider, reason="other", created_at: datetime | None = None):
    report = ProviderReport(provider_id=provider.id, reason=reason)
    if created_at is not None:
        report.created_at = created_at
    db.add(report)
    db.commit()
    return report


# ---------- create ----------


@pytest.mark.parametrize("status", ["verified", "unverified", "pending"])
def test_anyone_can_report_a_public_listing(client, db, status):
    provider = make_provider(db, make_category(db, "plumber"), status=status)
    body = {"reason": "not_real", "note": "  This shop closed years ago.  "}

    response = client.post(reports_url(provider.id), json=body)

    assert response.status_code == 201
    assert set(response.json()) == {"id"}
    saved = db.get(ProviderReport, uuid.UUID(response.json()["id"]))
    assert saved.provider_id == provider.id
    assert saved.reason == "not_real"
    assert saved.note == "This shop closed years ago."  # spaces around the text are removed
    assert saved.created_at is not None


@pytest.mark.parametrize("reason", ["wrong_info", "not_real", "closed", "offensive", "other"])
def test_every_reason_is_accepted_and_the_note_is_optional(client, db, reason):
    provider = make_provider(db, make_category(db, "plumber"))

    response = client.post(reports_url(provider.id), json={"reason": reason})

    assert response.status_code == 201
    saved = db.get(ProviderReport, uuid.UUID(response.json()["id"]))
    assert (saved.reason, saved.note) == (reason, None)


@pytest.mark.parametrize(
    "bad_body",
    [
        {},  # reason is required
        {"note": "no reason given"},
        {"reason": "boring"},  # not one of the five
        {"reason": None},
        {"reason": "other", "note": "x" * 501},
    ],
)
def test_create_validation(client, db, bad_body):
    provider = make_provider(db, make_category(db, "plumber"))

    response = client.post(reports_url(provider.id), json=bad_body)

    assert response.status_code == 422
    assert isinstance(response.json()["detail"], str)
    assert count_reports(db) == 0


def test_longest_allowed_note_is_accepted(client, db):
    provider = make_provider(db, make_category(db, "plumber"))

    response = client.post(reports_url(provider.id), json={"reason": "other", "note": "x" * 500})

    assert response.status_code == 201


def test_unknown_and_rejected_providers_are_404(client, db):
    rejected = make_provider(db, make_category(db, "plumber"), status="rejected")
    body = {"reason": "other"}

    assert client.post(reports_url(uuid.uuid4()), json=body).status_code == 404
    assert client.post(reports_url(rejected.id), json=body).status_code == 404
    assert count_reports(db) == 0


def test_table_stores_nothing_about_the_sender(db):
    columns = set(
        db.scalars(
            text(
                "SELECT column_name FROM information_schema.columns "
                "WHERE table_name = 'provider_reports'"
            )
        )
    )
    assert columns == {"id", "provider_id", "reason", "note", "created_at"}


def test_reports_disappear_with_their_provider(db):
    provider = make_provider(db, make_category(db, "plumber"))
    make_report(db, provider)

    db.execute(text("DELETE FROM providers"))  # ON DELETE CASCADE removes the report
    db.commit()

    assert count_reports(db) == 0


# ---------- rate limit ----------


def test_reports_are_limited_to_10_per_hour(client, db, clock):
    provider = make_provider(db, make_category(db, "plumber"))
    url = reports_url(provider.id)
    body = {"reason": "other"}

    for _ in range(10):
        assert client.post(url, json=body).status_code == 201

    blocked = client.post(url, json=body)
    assert blocked.status_code == 429
    assert isinstance(blocked.json()["detail"], str)
    assert 1 <= int(blocked.headers["Retry-After"]) <= 3600
    assert count_reports(db) == 10

    clock.advance(59 * 60)
    assert client.post(url, json=body).status_code == 429  # still inside the hour
    clock.advance(61)
    assert client.post(url, json=body).status_code == 201


def test_report_limit_is_separate_from_other_limits(client, db):
    provider = make_provider(db, make_category(db, "plumber"))
    for _ in range(10):
        client.post(reports_url(provider.id), json={"reason": "other"})

    # Out of reports, but contact events and suggestions still work.
    events_url = f"/api/v1/providers/{provider.id}/contact-events"
    assert client.post(events_url, json={"type": "view"}).status_code == 204
    assert client.post("/api/v1/suggestions", json={"name": "Abu Ali"}).status_code == 201


# ---------- admin ----------


def test_admin_routes_need_the_right_key(client, db):
    provider = make_provider(db, make_category(db, "plumber"))
    report = make_report(db, provider)
    delete_url = f"{ADMIN_URL}/{report.id}"
    wrong = {"X-Admin-Key": "wrong-key"}

    assert client.get(ADMIN_URL).status_code == 401
    assert client.get(ADMIN_URL, headers=wrong).status_code == 401
    assert client.delete(delete_url).status_code == 401
    assert client.delete(delete_url, headers=wrong).status_code == 401

    assert count_reports(db) == 1  # nothing was deleted


def test_admin_list_is_newest_first_with_the_provider(client, db):
    category = make_category(db, "plumber")
    shop = make_provider(db, category, "Old Shop", status="unverified")
    plumber = make_provider(db, category, "Abu Hassan Plumbing")
    now = datetime.now(UTC)
    make_report(db, shop, "closed", created_at=now - timedelta(days=2))
    make_report(db, plumber, "wrong_info", created_at=now - timedelta(days=1))
    created = client.post(
        reports_url(shop.id), json={"reason": "not_real", "note": "Never existed."}
    ).json()

    body = client.get(ADMIN_URL, headers=ADMIN_HEADERS).json()

    assert body["total"] == 3
    assert [item["reason"] for item in body["items"]] == ["not_real", "wrong_info", "closed"]
    newest = body["items"][0]
    assert set(newest) == {"id", "reason", "note", "created_at", "provider"}
    assert newest["id"] == created["id"]
    assert newest["note"] == "Never existed."
    assert newest["created_at"].endswith("Z")
    assert newest["provider"] == {"id": str(shop.id), "name": "Old Shop", "status": "unverified"}
    assert body["items"][1]["provider"]["status"] == "verified"
    assert body["items"][1]["note"] is None


def test_admin_list_still_shows_reports_of_a_listing_rejected_later(client, db):
    provider = make_provider(db, make_category(db, "plumber"), status="unverified")
    make_report(db, provider, "not_real")

    client.patch(
        f"/api/v1/admin/providers/{provider.id}", json={"status": "rejected"}, headers=ADMIN_HEADERS
    )

    body = client.get(ADMIN_URL, headers=ADMIN_HEADERS).json()
    assert body["items"][0]["provider"]["status"] == "rejected"


def test_admin_list_paging(client, db):
    provider = make_provider(db, make_category(db, "plumber"))
    now = datetime.now(UTC)
    reasons = ["wrong_info", "not_real", "closed", "offensive", "other"]
    for age, reason in enumerate(reasons):
        make_report(db, provider, reason, created_at=now - timedelta(hours=age))

    page = client.get(ADMIN_URL, params={"limit": 2, "offset": 1}, headers=ADMIN_HEADERS).json()

    assert [item["reason"] for item in page["items"]] == ["not_real", "closed"]
    assert page["total"] == 5
    for bad in ({"limit": 0}, {"limit": 101}, {"offset": -1}):
        assert client.get(ADMIN_URL, params=bad, headers=ADMIN_HEADERS).status_code == 422


def test_admin_list_when_empty(client):
    assert client.get(ADMIN_URL, headers=ADMIN_HEADERS).json() == {"items": [], "total": 0}


def test_admin_delete_removes_the_report_and_keeps_the_provider(client, db):
    provider = make_provider(db, make_category(db, "plumber"))
    keep = make_report(db, provider, "closed")
    remove = make_report(db, provider, "other")

    response = client.delete(f"{ADMIN_URL}/{remove.id}", headers=ADMIN_HEADERS)

    assert response.status_code == 204
    assert response.content == b""
    left = client.get(ADMIN_URL, headers=ADMIN_HEADERS).json()
    assert [item["id"] for item in left["items"]] == [str(keep.id)]
    assert db.get(Provider, provider.id) is not None

    # Deleting it again, or a made-up id, is 404; a bad id is 422.
    assert client.delete(f"{ADMIN_URL}/{remove.id}", headers=ADMIN_HEADERS).status_code == 404
    assert client.delete(f"{ADMIN_URL}/{uuid.uuid4()}", headers=ADMIN_HEADERS).status_code == 404
    assert client.delete(f"{ADMIN_URL}/not-a-uuid", headers=ADMIN_HEADERS).status_code == 422


def test_admin_page_has_the_reports_section(client):
    page = client.get("/admin").text

    assert "Reports" in page
    assert "/reports" in page
    assert "Dismiss" in page
    assert "Reject listing" in page
    assert "innerHTML" not in page
