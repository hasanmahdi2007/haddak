from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Category
from app.schemas import CategoryOut

router = APIRouter(tags=["categories"])


@router.get("/categories", response_model=list[CategoryOut])
def list_categories(db: Session = Depends(get_db)):
    """All categories as a flat list. The app builds the tree from parent_id."""
    query = select(Category).order_by(Category.sort_order, Category.id)
    return list(db.scalars(query))
