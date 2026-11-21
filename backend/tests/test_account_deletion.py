"""DELETE /me: a user deletes their account and everything Haddak keeps about them."""

import uuid
from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import func, select, text

from app.db import engine
from app.models import Claim, Follow, HireCheck, Provider, Review, Story
from app.services.account_deletion import delete_sign_in_account
from tests.conftest import auth_headers, make_category, make_provider

URL = "/api/v1/me"


def count(db, model, **filters) -> int:
    query = select(func.count()).select_from(model)
    for column, value in filters.items():
        query = query.where(getattr(model, column) == value)
    return db.scalar(query)


def leave_review(client, user_id, provider, rating: int) -> None:
    response = client.put(
        f"/api/v1/providers/{provider.id}/reviews/mine",
        json={"rating": rating, "comment": "", "author_name": "Sam"},
        headers=auth_headers(user_id),
    )
    assert response.status_code == 200, response.text


def test_needs_a_login(client):
    assert client.delete(URL).status_code == 401


def test_deletes_everything_that_belongs_to_the_user(client, db):
    me, someone_else = uuid.uuid4(), uuid.uuid4()
    category = make_category(db, "plumber")
    mine = make_provider(db, category, "My shop", owner_user_id=me)
    other = make_provider(db, category, "Other shop")
    db.add(
        Story(
            provider_id=mine.id, text="Open today", expires_at=datetime.now(UTC) + timedelta(days=1)
        )
    )
    db.add_all(
        [
            Follow(user_id=me, provider_id=other.id),
            Follow(user_id=someone_else, provider_id=other.id),
            HireCheck(user_id=me, provider_id=other.id, contact_type="call"),
            Claim(user_id=me, provider_id=other.id),
        ]
    )
    db.commit()
    leave_review(client, me, other, 1)
    leave_review(client, someone_else, other, 5)
    leave_review(client, someone_else, mine, 4)

    mine_id = mine.id
    response = client.delete(URL, headers=auth_headers(me))

    assert response.status_code == 204
    assert count(db, Provider, id=mine_id) == 0  # my business is gone ...
    assert count(db, Story) == 0  # ... with its stories
    assert count(db, Review, user_id=me) == 0
    assert count(db, Follow, user_id=me) == 0
    assert count(db, HireCheck, user_id=me) == 0
    assert count(db, Claim, user_id=me) == 0
    # Other people's things stay.
    assert count(db, Follow, user_id=someone_else) == 1
    assert count(db, Review, user_id=someone_else) == 1  # the one on my shop went with it


def test_the_ratings_i_gave_are_recalculated(client, db):
    me, someone_else = uuid.uuid4(), uuid.uuid4()
    other = make_provider(db, make_category(db, "plumber"))
    leave_review(client, me, other, 1)
    leave_review(client, someone_else, other, 5)

    client.delete(URL, headers=auth_headers(me))

    db.refresh(other)
    assert other.review_count == 1
    assert float(other.avg_rating) == 5.0


def test_deleting_twice_is_fine(client):
    me = uuid.uuid4()
    assert client.delete(URL, headers=auth_headers(me)).status_code == 204
    assert client.delete(URL, headers=auth_headers(me)).status_code == 204


@pytest.fixture
def fake_auth_users():
    """Stands in for Supabase: an auth.users-like table and the same
    haddak_private.delete_auth_user(uuid) function supabase/delete_auth_user.sql makes."""
    with engine.begin() as connection:
        connection.execute(
            text(
                "CREATE SCHEMA haddak_private;"
                "CREATE TABLE haddak_private.fake_users (id uuid PRIMARY KEY);"
                "CREATE FUNCTION haddak_private.delete_auth_user(user_id uuid) RETURNS void "
                "LANGUAGE sql SET search_path = '' "
                "AS $$ DELETE FROM haddak_private.fake_users WHERE id = user_id $$;"
            )
        )
    yield
    with engine.begin() as connection:
        connection.execute(text("DROP SCHEMA haddak_private CASCADE"))


def test_the_sign_in_account_is_deleted_too_when_supabase_is_there(client, fake_auth_users):
    me, someone_else = uuid.uuid4(), uuid.uuid4()
    with engine.begin() as connection:
        for user in (me, someone_else):
            connection.execute(
                text("INSERT INTO haddak_private.fake_users VALUES (:id)"), {"id": user}
            )

    assert client.delete(URL, headers=auth_headers(me)).status_code == 204

    with engine.connect() as connection:
        left = set(connection.scalars(text("SELECT id FROM haddak_private.fake_users")))
    assert left == {someone_else}


def test_without_supabase_the_sign_in_account_is_skipped(db):
    assert delete_sign_in_account(db, uuid.uuid4()) is False
