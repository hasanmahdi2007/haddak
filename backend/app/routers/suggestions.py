"""Public: suggest a provider who is not on Haddak yet.

The admin reads, publishes and deletes suggestions through routers/admin.py.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Category, ProviderSuggestion
from app.rate_limit import limit_suggestions
from app.schemas import SuggestionCreated, SuggestionIn

router = APIRouter(tags=["suggestions"])


@router.post(
    "/suggestions",
    response_model=SuggestionCreated,
    status_code=201,
    dependencies=[Depends(limit_suggestions)],
)
def create_suggestion(body: SuggestionIn, db: Session = Depends(get_db)):
    """No login needed. Nothing about the sender is stored (no user id, no IP)."""
    if body.category_id is not None and db.get(Category, body.category_id) is None:
        raise HTTPException(status_code=400, detail="Unknown category_id")

    suggestion = ProviderSuggestion(
        name=body.name,
        phone=body.phone,
        category_id=body.category_id,
        area_name=body.area_name,
        note=body.note,
        lat=body.lat,
        lng=body.lng,
    )
    db.add(suggestion)
    db.commit()
    return SuggestionCreated(id=suggestion.id)
