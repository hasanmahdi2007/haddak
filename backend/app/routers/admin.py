"""Admin endpoints. Every route here needs the X-Admin-Key header."""

import uuid
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.auth import require_admin
from app.db import get_db
from app.models import Provider, ProviderSuggestion
from app.schemas import AdminProviderUpdate, OwnProvider, OwnProviderList, SuggestionList
from app.services.provider_views import to_own

# dependencies=[...] applies the admin-key check to all routes in this file.
router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(require_admin)])


@router.get("/providers", response_model=OwnProviderList)
def list_providers_by_status(
    status: Literal["pending", "verified", "rejected"] = "pending",
    db: Session = Depends(get_db),
):
    """Profiles with the given status, oldest first (a review queue)."""
    query = (
        select(Provider).where(Provider.status == status).order_by(Provider.created_at, Provider.id)
    )
    items = [to_own(db, provider) for provider in db.scalars(query)]
    total = db.scalar(select(func.count()).select_from(Provider).where(Provider.status == status))
    return OwnProviderList(items=items, total=total or 0)


@router.patch("/providers/{provider_id}", response_model=OwnProvider)
def update_provider(
    provider_id: uuid.UUID, body: AdminProviderUpdate, db: Session = Depends(get_db)
):
    """Verify or reject a profile, or set founding member / featured."""
    provider = db.get(Provider, provider_id)
    if provider is None:
        raise HTTPException(status_code=404, detail="Provider not found")

    changes = body.model_dump(exclude_unset=True)
    for field_name, value in changes.items():
        setattr(provider, field_name, value)

    db.commit()
    db.refresh(provider)
    return to_own(db, provider)


@router.get("/suggestions", response_model=SuggestionList)
def list_suggestions(
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
):
    """Suggested providers, newest first."""
    query = (
        select(ProviderSuggestion)
        .order_by(ProviderSuggestion.created_at.desc(), ProviderSuggestion.id)
        .limit(limit)
        .offset(offset)
    )
    # response_model converts each row to SuggestionOut (from_attributes=True).
    items = list(db.scalars(query))
    total = db.scalar(select(func.count()).select_from(ProviderSuggestion))
    return {"items": items, "total": total or 0}


@router.delete("/suggestions/{suggestion_id}", status_code=204)
def delete_suggestion(suggestion_id: uuid.UUID, db: Session = Depends(get_db)):
    """Remove a suggestion once it has been dealt with."""
    suggestion = db.get(ProviderSuggestion, suggestion_id)
    if suggestion is None:
        raise HTTPException(status_code=404, detail="Suggestion not found")
    db.delete(suggestion)
    db.commit()
    return Response(status_code=204)
