"""Crash reports to Sentry, so the founder hears about errors before users do.

Off unless SENTRY_DSN is set (Sentry → project → Client Keys). Only errors
are sent, no performance tracing, which keeps the free plan's quota for what
matters.

Privacy, in line with /privacy:
  - send_default_pii=False: no IP address, cookies or user id;
  - the query string is dropped (it carries the user's lat/lng);
  - request bodies are dropped (reviews, phone numbers, Jarak's sentences);
  - Authorization and X-Admin-Key headers are dropped;
  - local variables are never sent (include_local_variables=False, and scrub
    removes any "vars" from stack frames as well): they hold lat/lng, phone
    numbers, review texts and assistant sentences.
"""

import sentry_sdk

from app.config import Settings

DROPPED_HEADERS = {"authorization", "x-admin-key", "cookie", "x-haddak-device"}


def drop_frame_variables(event: dict) -> None:
    """Remove the local variables of every stack frame in the event."""
    for exception in (event.get("exception") or {}).get("values") or []:
        for frame in (exception.get("stacktrace") or {}).get("frames") or []:
            frame.pop("vars", None)
    for thread in (event.get("threads") or {}).get("values") or []:
        for frame in (thread.get("stacktrace") or {}).get("frames") or []:
            frame.pop("vars", None)


def scrub(event: dict, _hint: dict) -> dict:
    """Runs on every event just before it leaves the server."""
    drop_frame_variables(event)
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
        include_local_variables=False,
        before_send=scrub,
    )
    return True
