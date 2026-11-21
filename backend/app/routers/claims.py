"""'Is this your business? Claim it'.

A signed-in user asks to own a listing that has no owner (published from a
suggestion or imported from OpenStreetMap). The founder approves or rejects
the claim in the admin page. Rules: docs/API.md, "POST /providers/{id}/claim".
"""

import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth import get_current_user_id, require_admin
from app.db import get_db
from app.models import Claim, Provider
from app.rate_limit import limit_claims
from app.routers.me import find_my_provider
from app.routers.providers import get_public_provider
from app.schemas import AdminClaimList, AdminClaimOut, ClaimIn, ClaimOut, ClaimStatus

router = APIRouter(tags=["claims"])
# Same admin-key check as routers/admin.py, for every route on this router.
admin_router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(require_admin)])


def find_pending_claim(db: Session, provider_id: uuid.UUID, user_id: uuid.UUID) -> Claim | None:
    return db.scalar(
        select(Claim).where(
            Claim.provider_id == provider_id,
            Claim.user_id == user_id,
            Claim.status == "pending",
        )
    )


@router.post(
    "/providers/{provider_id}/claim",
    response_model=ClaimOut,
    status_code=201,
    # The rate limit runs before the login check, like the other write routes.
    dependencies=[Depends(limit_claims)],
)
def claim_provider(
    provider_id: uuid.UUID,
    body: ClaimIn | None = None,
    db: Session = Depends(get_db),
    user_id: uuid.UUID = Depends(get_current_user_id),
):
    provider = get_public_provider(db, provider_id)
    if provider.owner_user_id is not None:
        raise HTTPException(status_code=409, detail="This listing already has an owner")
    # One profile per user (providers.owner_user_id is UNIQUE), so someone who
    # already has a business cannot take a second one.
    if find_my_provider(db, user_id) is not None:
        raise HTTPException(status_code=409, detail="You already have a provider profile")
    if find_pending_claim(db, provider.id, user_id) is not None:
        raise HTTPException(status_code=409, detail="You already asked to claim this listing")

    body = body or ClaimIn()
    claim = Claim(
        provider_id=provider.id,
        user_id=user_id,
        message=body.message,
        verification_doc_url=body.verification_doc_url,
    )
    db.add(claim)
    # Two identical requests at the same moment both pass the check above;
    # the partial unique index in the database then refuses the second one.
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409, detail="You already asked to claim this listing"
        ) from None
    db.refresh(claim)
    return claim


# ---------- Admin ----------


def get_claim_for_update(db: Session, claim_id: uuid.UUID) -> Claim:
    """Load a claim and lock its row, so two clicks cannot decide it twice."""
    claim = db.scalar(select(Claim).where(Claim.id == claim_id).with_for_update(of=Claim))
    if claim is None:
        raise HTTPException(status_code=404, detail="Claim not found")
    if claim.status != "pending":
        raise HTTPException(status_code=409, detail="This claim was already decided")
    return claim


@admin_router.get("/claims", response_model=AdminClaimList)
def list_claims(status: ClaimStatus = "pending", db: Session = Depends(get_db)):
    """Claims with the given status, oldest first (a review queue)."""
    query = (
        select(Claim).where(Claim.status == status).order_by(Claim.created_at, Claim.id).limit(200)
    )
    items = list(db.scalars(query))
    total = db.scalar(select(func.count()).select_from(Claim).where(Claim.status == status))
    return {"items": items, "total": total or 0}


@admin_router.post("/claims/{claim_id}/approve", response_model=AdminClaimOut)
def approve_claim(claim_id: uuid.UUID, db: Session = Depends(get_db)):
    claim = get_claim_for_update(db, claim_id)
    # Lock the listing too: two claims for it approved at once must not both win.
    provider = db.scalar(
        select(Provider).where(Provider.id == claim.provider_id).with_for_update(of=Provider)
    )
    if provider.owner_user_id is not None:
        raise HTTPException(status_code=409, detail="This listing already has an owner")
    if find_my_provider(db, claim.user_id) is not None:
        raise HTTPException(status_code=409, detail="This user already owns a provider profile")

    now = datetime.now(UTC)
    provider.owner_user_id = claim.user_id
    # With proof, the owner's proof rule applies (docs/SCHEMA.md): an
    # unverified listing now waits in the verification queue as 'pending'.
    # 'pending' and 'verified' stay; 'rejected' listings cannot be claimed.
    if claim.verification_doc_url:
        provider.verification_doc_url = claim.verification_doc_url
        if provider.status == "unverified":
            provider.status = "pending"

    claim.status = "approved"
    claim.decided_at = now
    # Everybody else who asked for this listing is turned down.
    db.execute(
        update(Claim)
        .where(Claim.provider_id == provider.id, Claim.status == "pending", Claim.id != claim.id)
        .values(status="rejected", decided_at=now)
    )
    db.commit()
    db.refresh(claim)
    return claim


@admin_router.post("/claims/{claim_id}/reject", response_model=AdminClaimOut)
def reject_claim(claim_id: uuid.UUID, db: Session = Depends(get_db)):
    claim = get_claim_for_update(db, claim_id)
    claim.status = "rejected"
    claim.decided_at = datetime.now(UTC)
    db.commit()
    db.refresh(claim)
    return claim
