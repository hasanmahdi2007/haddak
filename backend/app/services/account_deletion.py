"""Deleting a user's account and everything Haddak keeps about them.

Google Play requires apps that let people create an account to let them
delete it from inside the app. See docs/API.md, "DELETE /me".

What goes, in one transaction:
  - their reviews (and the rating of each provider they reviewed is recalculated);
  - who they follow;
  - their hire checks ("did you hire them?");
  - their claims on listings;
  - the business profile they own, with its stories, offer, reviews by
    others and contact counts (the foreign keys cascade).

Then their sign-in account in Supabase Auth (their email address).

Nothing else holds a user id: suggestions, reports, contact counts and the
assistant's logs are anonymous by design (see app/models.py).

Photos and proof documents are files in Supabase Storage. The app deletes
them with the user's own session just before calling this endpoint (the
storage rules let a user delete their own folder), so the server never needs
a key that can touch everyone's files.
"""

import logging
import uuid

from fastapi import HTTPException
from sqlalchemy import delete, select, text
from sqlalchemy.orm import Session

from app.config import settings
from app.models import Claim, Follow, HireCheck, Provider, Review
from app.services.ratings import recalculate_rating

logger = logging.getLogger("haddak.account")

# A function the founder created once in Supabase (supabase/delete_auth_user.sql).
# It runs with the rights of its owner, so it can delete one row from
# auth.users, which Haddak's own database role cannot touch. Local and test
# databases have no auth schema, so there it does not exist.
DELETE_AUTH_USER_FUNCTION = "haddak_private.delete_auth_user(uuid)"


def delete_account_data(db: Session, user_id: uuid.UUID) -> None:
    """Removes every row that belongs to the user. Does not commit."""
    # Reviews first, remembering whose rating must be recalculated.
    reviewed_provider_ids = set(
        db.scalars(select(Review.provider_id).where(Review.user_id == user_id))
    )
    # Lock those providers before touching their reviews, like every other
    # review path does (routers/reviews.py). Otherwise a review someone adds
    # at this very moment could be overwritten by our stale average. Always
    # in id order, so two transactions locking several providers can never
    # wait for each other in a circle (a deadlock).
    locked_providers = list(
        db.scalars(
            select(Provider)
            .where(Provider.id.in_(reviewed_provider_ids))
            .order_by(Provider.id)
            .with_for_update()
        )
    )
    db.execute(delete(Review).where(Review.user_id == user_id))

    db.execute(delete(Follow).where(Follow.user_id == user_id))
    db.execute(delete(HireCheck).where(HireCheck.user_id == user_id))
    db.execute(delete(Claim).where(Claim.user_id == user_id))

    own_provider_id = db.scalar(select(Provider.id).where(Provider.owner_user_id == user_id))
    if own_provider_id is not None:
        # Cascades to its stories, banner, reviews, reports, hire checks,
        # claims and contact events.
        db.execute(delete(Provider).where(Provider.id == own_provider_id))
        reviewed_provider_ids.discard(own_provider_id)

    for provider in locked_providers:
        if provider.id in reviewed_provider_ids:  # not the user's own, deleted above
            recalculate_rating(db, provider)


def delete_sign_in_account(db: Session, user_id: uuid.UUID) -> bool:
    """Deletes the user's Supabase Auth account. Does not commit.

    Returns False when this database has no such function (local development
    and tests), so there is no sign-in account to delete here.

    In production the function must exist: without it the user's email and
    sign-in account would stay while we answer "deleted" (for example after
    rebuilding the database and forgetting supabase/delete_auth_user.sql).
    So production refuses with 503 instead. Nothing is committed yet, so the
    whole request is rolled back and nothing is deleted; the user can try
    again once the founder has applied the script.
    """
    exists = db.scalar(
        text("SELECT to_regprocedure(:name) IS NOT NULL"), {"name": DELETE_AUTH_USER_FUNCTION}
    )
    if not exists:
        if settings.is_production():
            # Error level: reaches Sentry, so the founder hears about it.
            logger.error(
                "No %s in the production database: account deletion refused."
                " Apply supabase/delete_auth_user.sql (docs/DEPLOY.md, rebuild steps).",
                DELETE_AUTH_USER_FUNCTION,
            )
            raise HTTPException(
                status_code=503,
                detail="Account deletion is unavailable right now. Nothing was deleted; "
                "please try again later.",
            )
        logger.warning(
            "No %s in this database: sign-in account not deleted", DELETE_AUTH_USER_FUNCTION
        )
        return False
    db.execute(text("SELECT haddak_private.delete_auth_user(:user_id)"), {"user_id": user_id})
    return True


def delete_account(db: Session, user_id: uuid.UUID) -> None:
    """Everything, all or nothing: if any step fails, nothing is deleted and
    the user can simply try again."""
    delete_account_data(db, user_id)
    delete_sign_in_account(db, user_id)
    db.commit()
    # No email or other personal detail in the log: the id is enough to
    # answer "was my account deleted?" and is useless once deleted.
    logger.info("Account deleted: %s", user_id)
