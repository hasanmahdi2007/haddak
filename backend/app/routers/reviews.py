"""Reviews: list (public), create/update mine, delete mine."""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.auth import get_current_user_id, get_optional_user_id
from app.db import get_db
from app.models import PUBLIC_STATUSES, Provider, Review
from app.rate_limit import limit_writes
from app.routers.providers import get_public_provider
from app.schemas import ReviewIn, ReviewList, ReviewOut
from app.services.ratings import recalculate_rating

router = APIRouter(tags=["reviews"])


def to_review_out(review: Review, current_user_id: uuid.UUID | None) -> ReviewOut:
    return ReviewOut(
        id=review.id,
        author_name=review.author_name,
        rating=review.rating,
        comment=review.comment,
        created_at=review.created_at,
        is_mine=current_user_id is not None and review.user_id == current_user_id,
    )


def lock_reviewable_provider(db: Session, provider_id: uuid.UUID, user_id: uuid.UUID) -> Provider:
    """Load the provider for a review write, and lock its row.

    The lock (SELECT ... FOR UPDATE) makes two people reviewing the same
    provider at the same moment take turns, so the recalculated average
    always includes both reviews.
    """
    provider = db.scalar(
        select(Provider).where(Provider.id == provider_id).with_for_update(of=Provider)
    )
    if provider is None:
        raise HTTPException(status_code=404, detail="Provider not found")
    if provider.owner_user_id == user_id:
        raise HTTPException(status_code=403, detail="You cannot review your own profile")
    if provider.status not in PUBLIC_STATUSES:  # rejected: as if it did not exist
        raise HTTPException(status_code=404, detail="Provider not found")
    return provider


def find_my_review(db: Session, provider_id: uuid.UUID, user_id: uuid.UUID) -> Review | None:
    return db.scalar(
        select(Review).where(Review.provider_id == provider_id, Review.user_id == user_id)
    )


@router.get("/providers/{provider_id}/reviews", response_model=ReviewList)
def list_reviews(
    provider_id: uuid.UUID,
    limit: int = Query(default=20, ge=1, le=50),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    current_user_id: uuid.UUID | None = Depends(get_optional_user_id),
):
    provider = get_public_provider(db, provider_id)
    query = (
        select(Review)
        .where(Review.provider_id == provider.id)
        .order_by(Review.created_at.desc(), Review.id)
        .limit(limit)
        .offset(offset)
    )
    items = [to_review_out(review, current_user_id) for review in db.scalars(query)]
    total = db.scalar(
        select(func.count()).select_from(Review).where(Review.provider_id == provider.id)
    )
    return ReviewList(items=items, total=total or 0)


@router.get("/providers/{provider_id}/reviews/mine", response_model=ReviewOut | None)
def get_my_review(
    provider_id: uuid.UUID,
    db: Session = Depends(get_db),
    user_id: uuid.UUID = Depends(get_current_user_id),
):
    """My review of this provider, or null if I have not written one.

    The app needs this to offer "Edit" instead of "Write": my review may sit
    on a later page of the public list.
    """
    provider = get_public_provider(db, provider_id)
    review = find_my_review(db, provider.id, user_id)
    return None if review is None else to_review_out(review, user_id)


@router.put(
    "/providers/{provider_id}/reviews/mine",
    response_model=ReviewOut,
    dependencies=[Depends(limit_writes)],
)
def upsert_my_review(
    provider_id: uuid.UUID,
    body: ReviewIn,
    db: Session = Depends(get_db),
    user_id: uuid.UUID = Depends(get_current_user_id),
):
    """Create my review, or replace it if I already wrote one."""
    provider = lock_reviewable_provider(db, provider_id, user_id)

    review = find_my_review(db, provider.id, user_id)
    if review is None:
        review = Review(provider_id=provider.id, user_id=user_id)
        db.add(review)
    review.rating = body.rating
    review.comment = body.comment
    review.author_name = body.author_name

    # Same transaction: the review and the new average are saved together.
    recalculate_rating(db, provider)
    db.commit()
    db.refresh(review)
    return to_review_out(review, user_id)


@router.delete("/providers/{provider_id}/reviews/mine", status_code=204)
def delete_my_review(
    provider_id: uuid.UUID,
    db: Session = Depends(get_db),
    user_id: uuid.UUID = Depends(get_current_user_id),
):
    """Remove my review. Also answers 204 if I had none (nothing to remove)."""
    provider = lock_reviewable_provider(db, provider_id, user_id)

    review = find_my_review(db, provider.id, user_id)
    if review is not None:
        db.delete(review)
        recalculate_rating(db, provider)
    db.commit()
    return Response(status_code=204)
