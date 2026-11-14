"""One log line per request: method, path, status, duration.

Example:  GET /api/v1/providers/search 200 12ms

Privacy: only the PATH is logged. The query string is left out on purpose
(it carries the user's exact lat/lng), and no headers are logged at all, so
login tokens and the admin key can never end up in the logs.

Uvicorn has its own access log that DOES print the full query string, so run
uvicorn with --no-access-log in production (the Dockerfile does).
"""

import logging
import time

from fastapi import Request

logger = logging.getLogger("haddak.requests")


def configure_logging() -> None:
    """Send INFO-level log lines to the console (Python hides them by default)."""
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")


# This is the one `async` function in the project: FastAPI requires
# middleware to be async. `await call_next(request)` runs the actual route.
async def log_requests(request: Request, call_next):
    started = time.perf_counter()
    status_code = 500  # what the client gets if the route crashes
    try:
        response = await call_next(request)
        status_code = response.status_code
        return response
    finally:
        duration_ms = (time.perf_counter() - started) * 1000
        logger.info("%s %s %s %.0fms", request.method, request.url.path, status_code, duration_ms)
