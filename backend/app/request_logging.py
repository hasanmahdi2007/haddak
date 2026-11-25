"""One log line per request: method, path, status, request id, duration.

Example:  GET /api/v1/providers/search 200 req=3f2a9c1e0b7d4e55 12ms

Privacy: only the PATH is logged. The query string is left out on purpose
(it carries the user's exact lat/lng), and no headers are logged at all, so
login tokens and the admin key can never end up in the logs.

Uvicorn has its own access log that DOES print the full query string, so run
uvicorn with --no-access-log in production (the Dockerfile does).

Request id: every response carries an X-Request-ID header. When the caller
sends one (a short id of letters, digits, "-" or "_"), it is kept; otherwise
a new one is made. The same id is in the log line and on the Sentry report,
so "it failed at 21:04" can be matched to the exact error.
"""

import logging
import re
import time
import uuid

import sentry_sdk
from fastapi import Request

logger = logging.getLogger("haddak.requests")

REQUEST_ID_HEADER = "X-Request-ID"
# Anything else (too long, spaces, line breaks) is replaced, so a caller
# cannot write fake lines into the log through this header.
VALID_REQUEST_ID = re.compile(r"[A-Za-z0-9_-]{1,64}")


def configure_logging() -> None:
    """Send INFO-level log lines to the console (Python hides them by default)."""
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")


def request_id_for(request: Request) -> str:
    """The caller's X-Request-ID when it is safe to log, else a new one."""
    sent = request.headers.get(REQUEST_ID_HEADER, "")
    if VALID_REQUEST_ID.fullmatch(sent):
        return sent
    return uuid.uuid4().hex[:16]


# FastAPI requires middleware to be async. `await call_next(request)` runs
# the actual route (the routes themselves are plain `def` functions).
async def log_requests(request: Request, call_next):
    started = time.perf_counter()
    request_id = request_id_for(request)
    # Kept on the request, so the error handlers in main.py can return it too.
    request.state.request_id = request_id
    # Does nothing when Sentry is off.
    sentry_sdk.set_tag("request_id", request_id)
    status_code = 500  # what the client gets if the route crashes
    try:
        response = await call_next(request)
        status_code = response.status_code
        response.headers[REQUEST_ID_HEADER] = request_id
        return response
    finally:
        duration_ms = (time.perf_counter() - started) * 1000
        logger.info(
            "%s %s %s req=%s %.0fms",
            request.method,
            request.url.path,
            status_code,
            request_id,
            duration_ms,
        )
