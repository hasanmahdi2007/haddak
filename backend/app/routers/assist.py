"""POST /assist: the assistant (docs/AI_ASSISTANT.md, contract in docs/API.md).

No login needed. All the work happens in app/services/assist/service.py.
"""

import uuid

from fastapi import APIRouter, Depends, Header, Request
from sqlalchemy.orm import Session

from app.auth import get_optional_user_id
from app.db import get_db
from app.rate_limit import get_client_ip, limit_assist
from app.schemas import AssistIn, AssistOut
from app.services.assist.quota import Caller, parse_device_id
from app.services.assist.service import assist_from_text, assist_from_understood

router = APIRouter(tags=["assist"])


@router.post("/assist", response_model=AssistOut, dependencies=[Depends(limit_assist)])
def assist(
    body: AssistIn,
    request: Request,
    db: Session = Depends(get_db),
    user_id: uuid.UUID | None = Depends(get_optional_user_id),
    # The app's random install id, used only for the free daily AI allowance.
    x_haddak_device: str | None = Header(default=None),
):
    """Either a sentence ("baddé sankari 2arib") or settings the app got from
    an earlier answer (a clarify option or a place button).

    Always HTTP 200 for a valid body: when the AI cannot be used, `kind` is
    "unavailable" and the app runs a normal search instead. Only more than
    20 requests a minute from one IP get 429.
    """
    if body.understood is not None:
        return assist_from_understood(db, body)
    caller = Caller(
        ip=get_client_ip(request),
        user_id=user_id,
        device_id=parse_device_id(x_haddak_device),
    )
    return assist_from_text(db, body, caller)
