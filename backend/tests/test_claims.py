"""'Is this your business? Claim it': create, admin list, approve, reject."""

import uuid

from sqlalchemy import func, select

from app.models import Category, Claim, Provider, ProviderReport
from tests.conftest import ADMIN_HEADERS, auth_headers, make_category, make_provider

ADMIN_URL = "/api/v1/admin/claims"


def claim_url(provider_id) -> str:
    return f"/api/v1/providers/{provider_id}/claim"


def unclaimed(db, status="unverified", source="osm") -> Provider:
    """A listing nobody owns. The category is made once per test."""
    category = db.scalar(select(Category).where(Category.slug == "pharmacy"))
    category = category or make_category(db, "pharmacy")
    return make_provider(
        db, category, "Pharmacie Hamra", claimed=False, status=status, source=source
    )


def send_claim(client, provider, user_id, **body):
    return client.post(claim_url(provider.id), json=body, headers=auth_headers(user_id))


# ---------- create ----------


def test_signed_in_user_can_claim_an_unowned_listing(client, db):
    provider = unclaimed(db)
    user = uuid.uuid4()

    response = send_claim(
        client,
        provider,
        user,
        message="  I am the pharmacist.  ",
        verification_doc_url="https://example.com/signed/proof.jpg",
    )

    assert response.status_code == 201, response.text
    body = response.json()
    assert set(body) == {"id", "provider_id", "status", "created_at"}
    assert body["status"] == "pending"
    claim = db.get(Claim, uuid.UUID(body["id"]))
    assert claim.user_id == user
    assert claim.message == "I am the pharmacist."
    assert claim.verification_doc_url == "https://example.com/signed/proof.jpg"
    # Nothing changes on the listing until the founder decides.
    db.refresh(provider)
    assert provider.owner_user_id is None


def test_claim_body_is_optional_and_empty_text_means_none(client, db):
    provider = unclaimed(db)
    response = client.post(claim_url(provider.id), headers=auth_headers(uuid.uuid4()))
    assert response.status_code == 201
    response = send_claim(client, unclaimed(db, source="suggestion"), uuid.uuid4(), message="")
    assert response.status_code == 201
    assert db.get(Claim, uuid.UUID(response.json()["id"])).message is None


def test_claim_needs_a_login(client, db):
    provider = unclaimed(db)
    assert client.post(claim_url(provider.id), json={}).status_code == 401


def test_cannot_claim_an_owned_listing(client, db):
    provider = make_provider(db, make_category(db, "plumber"))
    response = send_claim(client, provider, uuid.uuid4())
    assert response.status_code == 409


def test_cannot_claim_rejected_or_unknown_listing(client, db):
    rejected = unclaimed(db, status="rejected")
    assert send_claim(client, rejected, uuid.uuid4()).status_code == 404
    response = client.post(claim_url(uuid.uuid4()), json={}, headers=auth_headers(uuid.uuid4()))
    assert response.status_code == 404


def test_one_open_claim_per_user_and_listing(client, db):
    provider = unclaimed(db)
    user = uuid.uuid4()
    assert send_claim(client, provider, user).status_code == 201
    assert send_claim(client, provider, user).status_code == 409
    # Somebody else may still ask.
    assert send_claim(client, provider, uuid.uuid4()).status_code == 201


def test_user_who_owns_a_profile_cannot_claim_another(client, db):
    owner = uuid.uuid4()
    make_provider(db, make_category(db, "plumber"), owner_user_id=owner)
    response = send_claim(client, unclaimed(db), owner)
    assert response.status_code == 409


def test_message_too_long_is_422(client, db):
    response = send_claim(client, unclaimed(db), uuid.uuid4(), message="x" * 501)
    assert response.status_code == 422


def test_claims_are_rate_limited(client, db):
    provider = unclaimed(db)
    codes = [send_claim(client, provider, uuid.uuid4()).status_code for _ in range(6)]
    assert codes == [201] * 5 + [429]


# ---------- admin ----------


def test_admin_lists_pending_claims_with_listing(client, db):
    provider = unclaimed(db)
    user = uuid.uuid4()
    send_claim(client, provider, user, message="Mine", verification_doc_url="https://x.com/p")

    response = client.get(ADMIN_URL, headers=ADMIN_HEADERS)

    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 1
    item = body["items"][0]
    assert item["user_id"] == str(user)
    assert item["message"] == "Mine"
    assert item["verification_doc_url"] == "https://x.com/p"
    assert item["provider"] == {
        "id": str(provider.id),
        "name": "Pharmacie Hamra",
        "status": "unverified",
    }
    assert (
        client.get(ADMIN_URL, params={"status": "approved"}, headers=ADMIN_HEADERS).json()["total"]
        == 0
    )


def test_admin_routes_need_the_key(client, db):
    assert client.get(ADMIN_URL).status_code in (401, 403)
    assert client.post(f"{ADMIN_URL}/{uuid.uuid4()}/approve").status_code in (401, 403)


def test_approve_with_proof_gives_the_listing_and_queues_verification(client, db):
    provider = unclaimed(db)
    user, other = uuid.uuid4(), uuid.uuid4()
    claim_id = send_claim(
        client, provider, user, verification_doc_url="https://example.com/proof.jpg"
    ).json()["id"]
    other_id = send_claim(client, provider, other).json()["id"]

    response = client.post(f"{ADMIN_URL}/{claim_id}/approve", headers=ADMIN_HEADERS)

    assert response.status_code == 200, response.text
    assert response.json()["status"] == "approved"
    assert response.json()["decided_at"] is not None
    db.expire_all()
    provider = db.get(Provider, provider.id)
    assert provider.owner_user_id == user
    assert provider.status == "pending"  # proof waits in the normal queue
    assert provider.verification_doc_url == "https://example.com/proof.jpg"
    assert provider.source == "osm"  # attribution stays
    assert db.get(Claim, uuid.UUID(other_id)).status == "rejected"

    # The claimer now sees it as their own business.
    mine = client.get("/api/v1/me/provider", headers=auth_headers(user))
    assert mine.status_code == 200
    assert mine.json()["id"] == str(provider.id)
    assert mine.json()["claimed"] is True


def test_approve_without_proof_keeps_the_status(client, db):
    provider = unclaimed(db, status="verified")
    provider.verification_doc_url = None
    db.commit()
    claim_id = send_claim(client, provider, uuid.uuid4()).json()["id"]

    assert client.post(f"{ADMIN_URL}/{claim_id}/approve", headers=ADMIN_HEADERS).status_code == 200
    db.expire_all()
    assert db.get(Provider, provider.id).status == "verified"


def test_approve_twice_or_after_someone_else_is_409(client, db):
    provider = unclaimed(db)
    first = send_claim(client, provider, uuid.uuid4()).json()["id"]
    assert client.post(f"{ADMIN_URL}/{first}/approve", headers=ADMIN_HEADERS).status_code == 200
    assert client.post(f"{ADMIN_URL}/{first}/approve", headers=ADMIN_HEADERS).status_code == 409


def test_approve_is_409_when_claimer_got_another_profile_meanwhile(client, db):
    provider = unclaimed(db)
    user = uuid.uuid4()
    claim_id = send_claim(client, provider, user).json()["id"]
    make_provider(db, make_category(db, "plumber"), owner_user_id=user)

    response = client.post(f"{ADMIN_URL}/{claim_id}/approve", headers=ADMIN_HEADERS)

    assert response.status_code == 409
    db.expire_all()
    assert db.get(Provider, provider.id).owner_user_id is None
    assert db.get(Claim, uuid.UUID(claim_id)).status == "pending"


def test_reject_claim(client, db):
    provider = unclaimed(db)
    user = uuid.uuid4()
    claim_id = send_claim(client, provider, user).json()["id"]

    response = client.post(f"{ADMIN_URL}/{claim_id}/reject", headers=ADMIN_HEADERS)

    assert response.status_code == 200
    assert response.json()["status"] == "rejected"
    db.expire_all()
    assert db.get(Provider, provider.id).owner_user_id is None
    assert client.post(f"{ADMIN_URL}/{claim_id}/reject", headers=ADMIN_HEADERS).status_code == 409
    # After a rejection the same user may ask again.
    assert send_claim(client, provider, user).status_code == 201


def test_unknown_claim_is_404(client, db):
    response = client.post(f"{ADMIN_URL}/{uuid.uuid4()}/approve", headers=ADMIN_HEADERS)
    assert response.status_code == 404


# ---------- OSM listings in public shapes, removal report ----------


def test_osm_listing_without_phone_shows_attribution_and_null_numbers(client, db):
    provider = unclaimed(db)
    provider.phone = None
    db.commit()

    detail = client.get(f"/api/v1/providers/{provider.id}").json()

    assert detail["data_source"] == "osm"
    assert detail["claimed"] is False
    assert detail["phone"] is None
    assert detail["whatsapp"] is None


def test_other_listings_have_no_data_source(client, db):
    provider = make_provider(db, make_category(db, "plumber"))
    assert client.get(f"/api/v1/providers/{provider.id}").json()["data_source"] is None


def test_owner_can_ask_for_removal_through_a_report(client, db):
    provider = unclaimed(db)
    response = client.post(
        f"/api/v1/providers/{provider.id}/reports", json={"reason": "remove_my_business"}
    )
    assert response.status_code == 201
    assert db.scalar(select(func.count()).select_from(ProviderReport)) == 1
