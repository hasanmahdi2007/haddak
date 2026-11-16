"""Reviews: create/update/delete mine, listing, and the rating recalculation."""

import uuid

from tests.conftest import auth_headers, make_category, make_provider


def reviews_url(provider) -> str:
    return f"/api/v1/providers/{provider.id}/reviews"


def put_review(client, provider, user_id, rating, comment="", author_name="Rana"):
    return client.put(
        reviews_url(provider) + "/mine",
        json={"rating": rating, "comment": comment, "author_name": author_name},
        headers=auth_headers(user_id),
    )


def rating_of(client, provider) -> tuple[float, int]:
    body = client.get(f"/api/v1/providers/{provider.id}").json()
    return body["avg_rating"], body["review_count"]


def test_average_follows_review_create_update_and_delete(client, db):
    provider = make_provider(db, make_category(db, "plumber"))
    rana, jad, lea = uuid.uuid4(), uuid.uuid4(), uuid.uuid4()
    assert rating_of(client, provider) == (0, 0)

    # Create: 5 -> average 5.0
    assert put_review(client, provider, rana, 5).status_code == 200
    assert rating_of(client, provider) == (5.0, 1)

    # Two more: (5 + 4 + 4) / 3 = 4.33
    put_review(client, provider, jad, 4)
    put_review(client, provider, lea, 4)
    assert rating_of(client, provider) == (4.33, 3)

    # Update (same user again): (2 + 4 + 4) / 3 = 3.33, still 3 reviews
    put_review(client, provider, rana, 2)
    assert rating_of(client, provider) == (3.33, 3)

    # Delete: (4 + 4) / 2 = 4.0
    response = client.delete(reviews_url(provider) + "/mine", headers=auth_headers(rana))
    assert response.status_code == 204
    assert rating_of(client, provider) == (4.0, 2)

    # Delete the rest: back to zero
    client.delete(reviews_url(provider) + "/mine", headers=auth_headers(jad))
    client.delete(reviews_url(provider) + "/mine", headers=auth_headers(lea))
    assert rating_of(client, provider) == (0, 0)


def test_put_twice_updates_instead_of_duplicating(client, db):
    provider = make_provider(db, make_category(db, "plumber"))
    user_id = uuid.uuid4()

    first = put_review(client, provider, user_id, 3, "It was okay").json()
    second = put_review(client, provider, user_id, 5, "Came back, much better").json()

    assert second["id"] == first["id"]
    assert second["rating"] == 5
    assert second["comment"] == "Came back, much better"
    assert second["is_mine"] is True
    listing = client.get(reviews_url(provider)).json()
    assert listing["total"] == 1


def test_cannot_review_own_profile(client, db):
    owner_id = uuid.uuid4()
    provider = make_provider(db, make_category(db, "plumber"), owner_user_id=owner_id)

    response = put_review(client, provider, owner_id, 5)

    assert response.status_code == 403
    assert rating_of(client, provider) == (0, 0)


def test_get_my_review_returns_mine_or_null(client, db):
    provider = make_provider(db, make_category(db, "plumber"))
    rana, jad = uuid.uuid4(), uuid.uuid4()
    put_review(client, provider, rana, 4, "Quick and tidy")

    mine = client.get(reviews_url(provider) + "/mine", headers=auth_headers(rana))
    assert mine.status_code == 200
    assert mine.json()["rating"] == 4
    assert mine.json()["is_mine"] is True

    # Someone who has not reviewed gets null, not someone else's review.
    none = client.get(reviews_url(provider) + "/mine", headers=auth_headers(jad))
    assert none.status_code == 200
    assert none.json() is None

    assert client.get(reviews_url(provider) + "/mine").status_code == 401


def test_owner_cannot_delete_through_own_profile_either(client, db):
    owner_id = uuid.uuid4()
    provider = make_provider(db, make_category(db, "plumber"), owner_user_id=owner_id)

    response = client.delete(reviews_url(provider) + "/mine", headers=auth_headers(owner_id))

    assert response.status_code == 403


def test_review_needs_a_token(client, db):
    provider = make_provider(db, make_category(db, "plumber"))
    body = {"rating": 5, "comment": "", "author_name": "Rana"}

    assert client.put(reviews_url(provider) + "/mine", json=body).status_code == 401
    assert client.delete(reviews_url(provider) + "/mine").status_code == 401


def test_rating_must_be_1_to_5(client, db):
    provider = make_provider(db, make_category(db, "plumber"))

    for bad_rating in (0, 6):
        assert put_review(client, provider, uuid.uuid4(), bad_rating).status_code == 422


def test_review_of_unknown_provider_is_404(client):
    response = client.put(
        f"/api/v1/providers/{uuid.uuid4()}/reviews/mine",
        json={"rating": 5, "comment": "", "author_name": "Rana"},
        headers=auth_headers(uuid.uuid4()),
    )
    assert response.status_code == 404


def test_list_is_newest_first_with_paging_and_is_mine(client, db):
    provider = make_provider(db, make_category(db, "plumber"))
    first_user, second_user, third_user = uuid.uuid4(), uuid.uuid4(), uuid.uuid4()
    put_review(client, provider, first_user, 3, author_name="First")
    put_review(client, provider, second_user, 4, author_name="Second")
    put_review(client, provider, third_user, 5, author_name="Third")

    anonymous = client.get(reviews_url(provider)).json()
    as_second = client.get(reviews_url(provider), headers=auth_headers(second_user)).json()
    page = client.get(reviews_url(provider), params={"limit": 1, "offset": 1}).json()

    assert [item["author_name"] for item in anonymous["items"]] == ["Third", "Second", "First"]
    assert anonymous["total"] == 3
    assert [item["is_mine"] for item in anonymous["items"]] == [False, False, False]
    assert [item["is_mine"] for item in as_second["items"]] == [False, True, False]
    assert [item["author_name"] for item in page["items"]] == ["Second"]
    assert page["total"] == 3
    assert set(anonymous["items"][0]) == {
        "id", "author_name", "rating", "comment", "created_at", "is_mine",
        "hired_through_haddak",
    }  # fmt: skip


def test_list_limit_is_capped_at_50(client, db):
    provider = make_provider(db, make_category(db, "plumber"))

    assert client.get(reviews_url(provider), params={"limit": 51}).status_code == 422
    assert client.get(reviews_url(provider), params={"limit": 50}).status_code == 200
