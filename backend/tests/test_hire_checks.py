"""Hire checks ("Did you hire them?"): creating, asking, answering, counting."""

import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select

from app.models import HireCheck
from tests.conftest import ADMIN_HEADERS, auth_headers, make_category, make_provider

PENDING_URL = "/api/v1/me/hire-checks/pending"
REVIEW_BODY = {"rating": 5, "comment": "Great work", "author_name": "Rana"}


def tap(client, provider, user_id=None, contact_type="whatsapp"):
    """A WhatsApp or Call tap, signed in when user_id is given."""
    headers = auth_headers(user_id) if user_id else {}
    return client.post(
        f"/api/v1/providers/{provider.id}/contact-events",
        json={"type": contact_type},
        headers=headers,
    )


def count_checks(db) -> int:
    db.expire_all()
    return db.scalar(select(func.count()).select_from(HireCheck)) or 0


def add_check(db, provider, user_id, *, hours_ago=24, answer=None, answered_days_ago=0):
    """Insert a check directly, with times in the past (no waiting in tests)."""
    now = datetime.now(UTC)
    check = HireCheck(
        provider_id=provider.id,
        user_id=user_id,
        contact_type="call",
        contacted_at=now - timedelta(hours=hours_ago),
        answer=answer,
        answered_at=None if answer is None else now - timedelta(days=answered_days_ago),
    )
    db.add(check)
    db.commit()
    return check


def answer(client, check_id, user_id, value="hired"):
    return client.post(
        f"/api/v1/me/hire-checks/{check_id}", json={"answer": value}, headers=auth_headers(user_id)
    )


# ---------- creating checks ----------


def test_signed_in_whatsapp_and_call_taps_create_a_check(client, db):
    provider = make_provider(db, make_category(db, "plumber"))
    user_id = uuid.uuid4()

    assert tap(client, provider, user_id, "call").status_code == 204

    db.expire_all()
    check = db.scalar(select(HireCheck))
    assert check.user_id == user_id
    assert check.provider_id == provider.id
    assert check.contact_type == "call"
    assert check.answer is None and check.answered_at is None


def test_anonymous_taps_views_and_bad_tokens_create_no_check(client, db):
    provider = make_provider(db, make_category(db, "plumber"))

    tap(client, provider)  # not signed in
    tap(client, provider, uuid.uuid4(), "view")  # a view is not a contact
    bad = {"Authorization": "Bearer not-a-token"}
    response = client.post(
        f"/api/v1/providers/{provider.id}/contact-events", json={"type": "call"}, headers=bad
    )

    assert response.status_code == 204  # a bad token is just "anonymous"
    assert count_checks(db) == 0


def test_only_one_check_per_user_and_provider_in_7_days(client, db):
    category = make_category(db, "plumber")
    provider = make_provider(db, category)
    other_provider = make_provider(db, category, "Other")
    user_id = uuid.uuid4()

    tap(client, provider, user_id, "whatsapp")
    tap(client, provider, user_id, "call")  # same provider, same week: nothing new
    assert count_checks(db) == 1

    tap(client, other_provider, user_id)  # another provider: its own check
    tap(client, provider, uuid.uuid4())  # another user: their own check
    assert count_checks(db) == 3


def test_a_new_check_is_made_after_7_days(client, db):
    provider = make_provider(db, make_category(db, "plumber"))
    user_id = uuid.uuid4()
    add_check(db, provider, user_id, hours_ago=8 * 24, answer="not_yet", answered_days_ago=7)

    tap(client, provider, user_id)

    assert count_checks(db) == 2


def test_an_answered_check_still_blocks_a_new_one_within_7_days(client, db):
    provider = make_provider(db, make_category(db, "plumber"))
    user_id = uuid.uuid4()
    add_check(db, provider, user_id, hours_ago=30, answer="hired")

    tap(client, provider, user_id)

    assert count_checks(db) == 1


def test_tapping_your_own_profile_creates_no_check(client, db):
    owner_id = uuid.uuid4()
    provider = make_provider(db, make_category(db, "plumber"), owner_user_id=owner_id)

    tap(client, provider, owner_id)

    assert count_checks(db) == 0


def test_the_10_minute_dedup_does_not_stop_a_check(client, db):
    provider = make_provider(db, make_category(db, "plumber"))
    tap(client, provider)  # anonymous tap is counted by IP first
    tap(client, provider, uuid.uuid4())  # same IP, same type: event deduplicated

    assert count_checks(db) == 1


# ---------- pending list ----------


def test_pending_lists_checks_between_12_hours_and_14_days_newest_first(client, db):
    category = make_category(db, "plumber")
    user_id = uuid.uuid4()
    too_new = add_check(db, make_provider(db, category, "A"), user_id, hours_ago=11)
    older = add_check(db, make_provider(db, category, "B"), user_id, hours_ago=48)
    newer = add_check(db, make_provider(db, category, "C"), user_id, hours_ago=13)
    too_old = add_check(db, make_provider(db, category, "D"), user_id, hours_ago=15 * 24)

    response = client.get(PENDING_URL, headers=auth_headers(user_id))

    assert response.status_code == 200
    ids = [item["id"] for item in response.json()["items"]]
    assert ids == [str(newer.id), str(older.id)]
    assert str(too_new.id) not in ids and str(too_old.id) not in ids
    item = response.json()["items"][0]
    assert item["provider"]["name"] == "C"
    assert item["provider"]["distance_m"] is None
    assert item["contact_type"] == "call"


def test_pending_shows_at_most_3_and_skips_answered_others_and_rejected(client, db):
    category = make_category(db, "plumber")
    user_id = uuid.uuid4()
    for hours in (20, 21, 22, 23):
        add_check(db, make_provider(db, category, f"P{hours}"), user_id, hours_ago=hours)
    add_check(db, make_provider(db, category, "Answered"), user_id, hours_ago=13, answer="hired")
    add_check(db, make_provider(db, category, "Theirs"), uuid.uuid4(), hours_ago=13)
    rejected = make_provider(db, category, "Gone", status="rejected")
    add_check(db, rejected, user_id, hours_ago=13)

    items = client.get(PENDING_URL, headers=auth_headers(user_id)).json()["items"]

    assert [item["provider"]["name"] for item in items] == ["P20", "P21", "P22"]


def test_pending_needs_login(client):
    assert client.get(PENDING_URL).status_code == 401


# ---------- answering ----------


def test_owner_answers_once(client, db):
    user_id = uuid.uuid4()
    check = add_check(db, make_provider(db, make_category(db, "plumber")), user_id)

    assert answer(client, check.id, user_id, "not_yet").status_code == 204
    assert answer(client, check.id, user_id, "hired").status_code == 409

    db.expire_all()
    stored = db.get(HireCheck, check.id)
    assert stored.answer == "not_yet"
    assert stored.answered_at is not None
    # Answered checks are no longer pending.
    assert client.get(PENDING_URL, headers=auth_headers(user_id)).json()["items"] == []


def test_someone_elses_or_unknown_check_is_404(client, db):
    check = add_check(db, make_provider(db, make_category(db, "plumber")), uuid.uuid4())

    assert answer(client, check.id, uuid.uuid4()).status_code == 404
    assert answer(client, uuid.uuid4(), uuid.uuid4()).status_code == 404


def test_answer_must_be_one_of_three_and_needs_login(client, db):
    user_id = uuid.uuid4()
    check = add_check(db, make_provider(db, make_category(db, "plumber")), user_id)

    assert answer(client, check.id, user_id, "maybe").status_code == 422
    url = f"/api/v1/me/hire-checks/{check.id}"
    assert client.post(url, json={"answer": "hired"}).status_code == 401


def test_answering_shares_the_write_rate_limit(client, db, clock):
    user_id = uuid.uuid4()
    check = add_check(db, make_provider(db, make_category(db, "plumber")), user_id)

    for _ in range(20):  # 20 writes (answered once, then 409s) are allowed
        assert answer(client, check.id, user_id).status_code in (204, 409)
    blocked = answer(client, check.id, user_id)

    assert blocked.status_code == 429
    clock.advance(61)
    assert answer(client, check.id, user_id).status_code == 409


# ---------- "Hired through Haddak" on reviews ----------


def test_review_written_before_the_answer_gets_the_mark(client, db):
    provider = make_provider(db, make_category(db, "plumber"))
    user_id = uuid.uuid4()
    review_url = f"/api/v1/providers/{provider.id}/reviews/mine"
    client.put(review_url, json=REVIEW_BODY, headers=auth_headers(user_id))
    client.put(review_url, json=REVIEW_BODY, headers=auth_headers(uuid.uuid4()))

    before = client.get(f"/api/v1/providers/{provider.id}/reviews").json()["items"]
    assert [item["hired_through_haddak"] for item in before] == [False, False]

    check = add_check(db, provider, user_id)
    answer(client, check.id, user_id, "hired")

    items = client.get(f"/api/v1/providers/{provider.id}/reviews").json()["items"]
    assert sorted(item["hired_through_haddak"] for item in items) == [False, True]
    mine = client.get(review_url, headers=auth_headers(user_id)).json()
    assert mine["hired_through_haddak"] is True


def test_review_written_after_hired_gets_the_mark_but_not_after_other_answers(client, db):
    category = make_category(db, "plumber")
    provider = make_provider(db, category)
    hired_user, waiting_user = uuid.uuid4(), uuid.uuid4()
    answer(client, add_check(db, provider, hired_user).id, hired_user, "hired")
    answer(client, add_check(db, provider, waiting_user).id, waiting_user, "not_yet")
    review_url = f"/api/v1/providers/{provider.id}/reviews/mine"

    hired_review = client.put(review_url, json=REVIEW_BODY, headers=auth_headers(hired_user))
    waiting_review = client.put(review_url, json=REVIEW_BODY, headers=auth_headers(waiting_user))

    assert hired_review.json()["hired_through_haddak"] is True
    assert waiting_review.json()["hired_through_haddak"] is False


# ---------- counts ----------


def test_confirmed_hires_counts_hired_answers_in_the_last_90_days(client, db):
    owner_id = uuid.uuid4()
    provider = make_provider(db, make_category(db, "plumber"), owner_user_id=owner_id)
    add_check(db, provider, uuid.uuid4(), answer="hired", answered_days_ago=1)
    add_check(db, provider, uuid.uuid4(), answer="hired", answered_days_ago=80)
    add_check(db, provider, uuid.uuid4(), answer="hired", answered_days_ago=100)  # too old
    add_check(db, provider, uuid.uuid4(), answer="not_yet")
    add_check(db, provider, uuid.uuid4(), answer="no_answer")
    add_check(db, provider, uuid.uuid4())  # not answered

    detail = client.get(f"/api/v1/providers/{provider.id}").json()
    stats = client.get("/api/v1/me/provider/stats", headers=auth_headers(owner_id)).json()
    own = client.get("/api/v1/me/provider", headers=auth_headers(owner_id)).json()

    assert detail["confirmed_hires"] == 2
    assert stats["confirmed_hires"] == 2
    assert own["confirmed_hires"] == 2
    # "They didn't answer" is for the founder only.
    for body in (detail, stats, own):
        assert "no_answer_count_90d" not in body


def test_admin_list_shows_no_answer_count_for_90_days(client, db):
    category = make_category(db, "plumber")
    quiet = make_provider(db, category, "Quiet")
    fine = make_provider(db, category, "Fine")
    add_check(db, quiet, uuid.uuid4(), answer="no_answer", answered_days_ago=2)
    add_check(db, quiet, uuid.uuid4(), answer="no_answer", answered_days_ago=10)
    add_check(db, quiet, uuid.uuid4(), answer="no_answer", answered_days_ago=95)  # too old
    add_check(db, fine, uuid.uuid4(), answer="hired")

    body = client.get("/api/v1/admin/providers?status=verified", headers=ADMIN_HEADERS).json()

    counts = {item["name"]: item["no_answer_count_90d"] for item in body["items"]}
    assert counts == {"Quiet": 2, "Fine": 0}
