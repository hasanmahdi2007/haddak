"""The FastAPI application: wires the routers together.

Run with:  uvicorn app.main:app --reload
Docs at:   http://localhost:8000/docs
Admin at:  http://localhost:8000/admin
"""

from pathlib import Path

from fastapi import APIRouter, Depends, FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.config import Settings, check_startup_settings, settings
from app.db import get_db
from app.error_tracking import init_error_tracking
from app.legal_pages import router as legal_pages_router
from app.request_limits import BodySizeLimit
from app.request_logging import configure_logging, log_requests
from app.routers import (
    admin,
    assist,
    categories,
    claims,
    follows,
    hire_checks,
    me,
    posts,
    providers,
    reviews,
    suggestions,
)

# Stops here with a clear error if production is misconfigured.
check_startup_settings(settings)
configure_logging()
init_error_tracking(settings)


def docs_urls(current: Settings) -> dict[str, str | None]:
    """The interactive API docs (/docs, /redoc, /openapi.json) help while
    building. In production they are off: they would publish a map of every
    route, admin routes included, to anyone."""
    if current.is_production():
        return {"docs_url": None, "redoc_url": None, "openapi_url": None}
    return {"docs_url": "/docs", "redoc_url": "/redoc", "openapi_url": "/openapi.json"}


app = FastAPI(title="Haddak API", version="1.0.0", **docs_urls(settings))

app.middleware("http")(log_requests)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    """Headers every response gets. Pages that need more (admin, sign-in
    bridge, legal pages) set their own on top.

    - nosniff: a browser never guesses a JSON answer is a script or page.
    - HSTS (production only, where Render serves HTTPS): browsers refuse
      plain http to this host for a year, so nobody on the café Wi-Fi can
      downgrade the connection.
    """
    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    if settings.is_production():
        response.headers.setdefault("Strict-Transport-Security", "max-age=31536000")
    return response


# CORS only matters for web pages on OTHER domains calling this API. The
# phone app is not a web page, and the admin page is served from this same
# server, so production can leave CORS_ORIGINS empty.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list(),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Added last, so it runs first: an oversized body is refused before anything else.
app.add_middleware(BodySizeLimit)


@app.exception_handler(RequestValidationError)
def validation_error_handler(request: Request, error: RequestValidationError) -> JSONResponse:
    """Return validation problems as {"detail": "one readable message"}.

    FastAPI's default is a list of objects; docs/API.md promises a string, so
    the app can show it or log it without special handling.
    """
    messages = []
    for problem in error.errors():
        # loc looks like ("body", "phone") or ("query", "radius_m").
        field = ".".join(str(part) for part in problem["loc"][1:])
        messages.append(f"{field}: {problem['msg']}" if field else problem["msg"])
    return JSONResponse(status_code=422, content={"detail": "; ".join(messages)})


# ---------- admin page (outside /api/v1) ----------

ADMIN_PAGE = Path(__file__).parent / "static" / "admin.html"

# The page is public and contains no secrets or data: everything it shows is
# fetched from the admin endpoints, which need the key. These headers make
# the browser stricter:
ADMIN_PAGE_HEADERS = {
    # Only this page's own script and style may run, and it may only call
    # this server. Blocks injected scripts and loading anything external.
    "Content-Security-Policy": (
        "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; "
        "connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"
    ),
    "X-Frame-Options": "DENY",  # cannot be embedded in another site
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "no-store",
}


@app.get("/admin", include_in_schema=False)
def admin_page() -> FileResponse:
    return FileResponse(ADMIN_PAGE, media_type="text/html", headers=ADMIN_PAGE_HEADERS)


# ---------- sign-in email bridge (outside /api/v1) ----------

# The link in the sign-in email opens in a browser. A browser cannot show an
# app link (haddak:// or exp://) directly, so the email points here instead and
# this page hands the code on to the app. See docs/API.md "Sign-in link".
AUTH_OPEN_PAGE = Path(__file__).parent / "static" / "auth-open.html"
AUTH_OPEN_HEADERS = {
    "Content-Security-Policy": (
        "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; "
        "base-uri 'none'; form-action 'none'; frame-ancestors 'none'"
    ),
    "X-Frame-Options": "DENY",
    # The address holds a one-time sign-in code: never send it to other sites.
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "no-store",
}


@app.get("/auth/open", include_in_schema=False)
def auth_open_page() -> FileResponse:
    return FileResponse(AUTH_OPEN_PAGE, media_type="text/html", headers=AUTH_OPEN_HEADERS)


# ---------- privacy policy, terms, account deletion (outside /api/v1) ----------

app.include_router(legal_pages_router)


# ---------- the API ----------

api = APIRouter(prefix="/api/v1")


@api.get("/health", tags=["health"])
def health(db: Session = Depends(get_db)) -> dict[str, str]:
    """Used by the hosting platform to decide whether the server is healthy.
    Runs a trivial query so a broken database connection is noticed."""
    try:
        db.execute(text("SELECT 1"))
    except SQLAlchemyError as error:
        raise HTTPException(status_code=503, detail="Database is unreachable") from error
    return {"status": "ok"}


api.include_router(categories.router)
api.include_router(providers.router)
api.include_router(reviews.router)
api.include_router(me.router)
api.include_router(suggestions.router)
api.include_router(posts.router)
api.include_router(follows.router)
api.include_router(hire_checks.router)
api.include_router(assist.router)
api.include_router(admin.router)
api.include_router(claims.router)
api.include_router(claims.admin_router)

app.include_router(api)
