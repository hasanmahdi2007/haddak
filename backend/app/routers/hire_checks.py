"""Hire checks ("Did you hire them?"): my pending questions, and answering one.

The checks themselves are created in routers/providers.py, when a signed-in
user taps WhatsApp or Call. The rules live in services/hire_checks.py.
"""

import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import get_current_user_id
from app.db import get_db
from app.models import HireCheck, Provider
from app.rate_limit import limit_writes
from app.schemas import HireAnswerIn, HireCheckList, HireCheckOut
from app.services.hire_checks import pending_checks
from app.services.provider_views import to_summaries

router = APIRouter(tags=["hire checks"])


@router.get("/me/hire-checks/pending", response_model=HireCheckList)
def list_my_pending_checks(
    db: Session = Depends(get_db),
    user_id: uuid.UUID = Depends(get_current_user_id),
):
    """Up to 3 unanswered checks, made 12 hours to 14 days ago, newest first."""
    checks = pending_checks(db, user_id)
    if not checks:
        return HireCheckList(items=[])

    # Load all the providers in one query, then build their summaries together.
    provider_ids = [check.provider_id for check in checks]
    providers = {p.id: p for p in db.scalars(select(Provider).where(Provider.id.in_(provider_ids)))}
    summaries = to_summaries(db, [(providers[pid], None) for pid in provider_ids])

    items = [
        HireCheckOut(
            id=check.id,
            contact_type=check.contact_type,
            contacted_at=check.contacted_at,
            provider=summary,
        )
        for check, summary in zip(checks, summaries, strict=True)
    ]
    return HireCheckList(items=items)


@router.post("/me/hire-checks/{check_id}", status_code=204, dependencies=[Depends(limit_writes)])
def answer_check(
    check_id: uuid.UUID,
    body: HireAnswerIn,
    db: Session = Depends(get_db),
    user_id: uuid.UUID = Depends(get_current_user_id),
):
    """Answer "Did you hire them?" once: hired, not_yet or no_answer."""
    # FOR UPDATE: two answers sent at the same moment take turns, so the
    # second one sees the first and gets 409 instead of overwriting it.
    check = db.scalar(select(HireCheck).where(HireCheck.id == check_id).with_for_update())

    # Someone else's check answers 404, exactly like a missing one, so ids
    # of other people's checks cannot be discovered.
    if check is None or check.user_id != user_id:
        raise HTTPException(status_code=404, detail="Hire check not found")
    if check.answer is not None:
        raise HTTPException(status_code=409, detail="This hire check was already answered")

    check.answer = body.answer
    check.answered_at = datetime.now(UTC)
    db.commit()
    return Response(status_code=204)
