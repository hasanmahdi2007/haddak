"""Crash reports to Sentry, so the founder hears about errors before users do.

Off unless SENTRY_DSN is set (Sentry → project → Client Keys). Only errors
are sent, no performance tracing, which keeps the free plan's quota for what
matters.

Privacy, in line with /privacy:
  - send_default_pii=False: no IP address, cookies or user id;
  - the query string is dropped (it carries the user's lat/lng);
  - request bodies are dropped (reviews, phone numbers, Jarak's sentences);
  - Authorization and X-Admin-Key headers are dropped.
"""

import sentry_sdk

from app.config import Settings

DROPPED_HEADERS = {"authorization", "x-admin-key", "cookie", "x-haddak-device"}


def scrub(event: dict, _hint: dict) -> dict:
    """Runs on every event just before it leaves the server."""
    request = event.get("request")
    if request:
        request.pop("query_string", None)
        request.pop("data", None)
        request.pop("cookies", None)
        if url := request.get("url"):
            request["url"] = url.split("?", 1)[0]
        headers = request.get("headers") or {}
        request["headers"] = {
            name: value for name, value in headers.items() if name.lower() not in DROPPED_HEADERS
        }
    return event


def init_error_tracking(settings: Settings) -> bool:
    """Starts Sentry when configured. Returns whether it is on."""
    dsn = settings.sentry_dsn.strip()
    if not dsn:
        return False
    sentry_sdk.init(
        dsn=dsn,
        environment=settings.environment,
        send_default_pii=False,
        traces_sample_rate=0.0,
        max_request_body_size="never",
        before_send=scrub,
    )
    return True
