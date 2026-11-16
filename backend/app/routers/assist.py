"""POST /assist: the assistant (docs/AI_ASSISTANT.md, contract in docs/API.md).

No login needed. All the work happens in app/services/assist/service.py.
"""

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.db import get_db
from app.rate_limit import get_client_ip
from app.schemas import AssistIn, AssistOut
from app.services.assist.service import assist_from_text, assist_from_understood

router = APIRouter(tags=["assist"])


@router.post("/assist", response_model=AssistOut)
def assist(body: AssistIn, request: Request, db: Session = Depends(get_db)):
    """Either a sentence ("baddé sankari 2arib") or settings the app got from
    an earlier answer (a clarify option or a place button).

    Always HTTP 200 for a valid body: when the AI cannot be used, `kind` is
    "unavailable" and the app runs a normal search instead.
    """
    if body.understood is not None:
        return assist_from_understood(db, body)
    return assist_from_text(db, body, get_client_ip(request))
