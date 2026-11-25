from fastapi import APIRouter, Depends, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Category
from app.rate_limit import limit_reads
from app.schemas import CategoryOut

router = APIRouter(tags=["categories"])

# Categories change only with a migration, that is, with a deploy. So the
# phone (and any proxy on the way) may keep this answer for an hour instead
# of downloading all 143 rows on every app start.
CATEGORIES_CACHE_CONTROL = "public, max-age=3600"


@router.get("/categories", response_model=list[CategoryOut], dependencies=[Depends(limit_reads)])
def list_categories(response: Response, db: Session = Depends(get_db)):
    """All categories as a flat list. The app builds the tree from parent_id."""
    response.headers["Cache-Control"] = CATEGORIES_CACHE_CONTROL
    query = select(Category).order_by(Category.sort_order, Category.id)
    return list(db.scalars(query))
