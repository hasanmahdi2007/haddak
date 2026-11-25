"""The FastAPI application: wires the routers together.

Run with:  uvicorn app.main:app --reload
Docs at:   http://localhost:8000/docs
Admin at:  http://localhost:8000/admin
"""

import logging
from pathlib import Path

from fastapi import APIRouter, Depends, FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse
from sqlalchemy import text
from sqlalchemy.exc import OperationalError, SQLAlchemyError
from sqlalchemy.exc import TimeoutError as PoolTimeoutError
from sqlalchemy.orm import Session

from app.auth_open import auth_open_response
from app.config import Settings, check_startup_settings, settings
from app.db import get_db
from app.error_tracking import init_error_tracking
from app.legal_pages import router as legal_pages_router
from app.request_limits import BodySizeLimit
from app.request_logging import REQUEST_ID_HEADER, configure_logging, log_requests
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


# ---------- errors nobody caught ----------
# Without these, a database outage or a bug answers with Starlette's plain
# text "Internal Server Error", which breaks the {"detail": ...} promise in
# docs/API.md. Both are still reported: logger.error with the traceback
# reaches the Render logs and Sentry (Sentry records error-level log lines).

errors_logger = logging.getLogger("haddak.errors")

DATABASE_BUSY = "The database is busy or unreachable. Try again in a moment."
UNEXPECTED_ERROR = "Something went wrong on our side. Try again in a moment."

# SQLSTATE for "cannot execute ... in a read-only transaction". Supabase
# switches a free project that is over its size limit to read-only.
READ_ONLY_SQLSTATE = "25006"


def database_unavailable(error: Exception) -> bool:
    """True for errors that mean "the database cannot serve us right now",
    as opposed to a bug in our query:
    - OperationalError: connection refused or dropped, statement timeout;
    - TimeoutError: every pooled connection is in use (pool_timeout passed);
    - a read-only database (writes refused)."""
    if isinstance(error, OperationalError | PoolTimeoutError):
        return True
    return getattr(getattr(error, "orig", None), "sqlstate", None) == READ_ONLY_SQLSTATE


def error_response(request: Request, status_code: int, detail: str) -> JSONResponse:
    response = JSONResponse(status_code=status_code, content={"detail": detail})
    request_id = getattr(request.state, "request_id", None)
    if request_id:
        response.headers[REQUEST_ID_HEADER] = request_id
    return response


@app.exception_handler(SQLAlchemyError)
def database_error_handler(request: Request, error: SQLAlchemyError) -> JSONResponse:
    """Any database error a route did not handle itself: 503 when the
    database is unavailable (the app may retry), 500 otherwise."""
    errors_logger.error("database error on %s %s", request.method, request.url.path, exc_info=error)
    if database_unavailable(error):
        return error_response(request, 503, DATABASE_BUSY)
    return error_response(request, 500, UNEXPECTED_ERROR)


@app.exception_handler(Exception)
def unexpected_error_handler(request: Request, error: Exception) -> JSONResponse:
    """Any other crash. Starlette still re-raises the error after this answer
    is sent, so uvicorn logs the traceback and Sentry records it."""
    return error_response(request, 500, UNEXPECTED_ERROR)


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
# app link (haddak://) directly, so the email points here instead and this
# page hands the code on to the app. The rules are in app/auth_open.py.


@app.get("/auth/open", include_in_schema=False)
def auth_open_page(request: Request) -> HTMLResponse:
    return auth_open_response(request)


# ---------- privacy policy, terms, account deletion (outside /api/v1) ----------

app.include_router(legal_pages_router)


# ---------- the API ----------

api = APIRouter(prefix="/api/v1")


@api.get("/live", tags=["health"])
def live() -> dict[str, str]:
    """Liveness: the process is up and answering. Touches nothing else.

    This is Render's healthCheckPath. If it checked the database, a
    database outage or a full connection pool would make Render restart a
    perfectly healthy process (and wipe its in-memory rate limits) without
    fixing anything."""
    return {"status": "ok"}


@api.get("/health", tags=["health"])
def health(db: Session = Depends(get_db)) -> dict[str, str]:
    """Deep check for the uptime monitor: also runs a trivial query, so a
    broken database connection is noticed. (Render uses /live instead.)"""
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
