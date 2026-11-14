"""Keeps providers.avg_rating and providers.review_count in step with reviews."""

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Provider, Review


def recalculate_rating(db: Session, provider: Provider) -> None:
    """Recompute the provider's average and count from its review rows.

    Does not commit: the caller commits once, so the review change and the
    new average are saved together (or not at all).
    """
    db.flush()  # make sure the review change just made is visible to the query
    average, count = db.execute(
        select(func.avg(Review.rating), func.count(Review.id)).where(
            Review.provider_id == provider.id
        )
    ).one()
    provider.avg_rating = round(average, 2) if average is not None else 0
    provider.review_count = count
