"""Admin endpoints. Every route here needs the X-Admin-Key header."""

import uuid
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.auth import require_admin
from app.db import get_db
from app.models import Provider
from app.schemas import AdminProviderUpdate, OwnProvider, OwnProviderList
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
    items = [to_own(provider) for provider in db.scalars(query)]
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
    return to_own(provider)
