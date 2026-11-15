"""Rate limiting, as described in the "Rate limits" section of docs/API.md.

LIMITATION: everything here lives in this process's memory (plain dicts).
It is forgotten when the server restarts, and each server process keeps its
own counts. That is fine while the API runs as ONE instance with one worker.
If it is ever scaled to several, the limits become "per instance" and this
should move to a shared store.
"""

import math
import threading
import time
from collections.abc import Callable

from fastapi import HTTPException, Request

from app.config import settings

# Limits from docs/API.md.
CONTACT_EVENTS_PER_MINUTE = 30
WRITES_PER_MINUTE = 20
SUGGESTIONS_PER_HOUR = 5
ONE_MINUTE = 60
ONE_HOUR = 60 * 60
CONTACT_EVENT_DEDUP_SECONDS = 10 * 60

# When this many keys are remembered, forget the ones that are too old to matter.
CLEANUP_THRESHOLD = 10_000
LONGEST_WINDOW_SECONDS = CONTACT_EVENT_DEDUP_SECONDS


class RateLimiter:
    """Remembers when things happened, per key (e.g. "writes:1.2.3.4").

    `clock` is a function returning the current time in seconds. Tests replace
    it with a fake clock so they can "wait" ten minutes instantly.
    """

    def __init__(self, clock: Callable[[], float] = time.monotonic):
        self.clock = clock
        self._hits: dict[str, list[float]] = {}  # key -> times of recent requests
        self._windows: dict[str, int] = {}  # key -> the window it is counted over
        self._last_seen: dict[str, float] = {}  # key -> time it was last counted
        # Requests run on several threads at once; the lock makes each check
        # happen one at a time (like `synchronized` in Java).
        self._lock = threading.Lock()

    def seconds_to_wait(self, key: str, limit: int, window_seconds: int) -> int:
        """Count one request for `key`.

        Returns 0 if it is allowed, or how many seconds the caller must wait
        if `key` already made `limit` requests in the last `window_seconds`.
        """
        with self._lock:
            now = self.clock()
            window_start = now - window_seconds
            recent = [moment for moment in self._hits.get(key, []) if moment > window_start]

            if len(recent) >= limit:
                self._hits[key] = recent
                # The oldest request leaves the window first; then there is room.
                return max(1, math.ceil(recent[0] + window_seconds - now))

            recent.append(now)
            self._hits[key] = recent
            self._windows[key] = window_seconds
            self._forget_old_keys(now)
            return 0

    def is_repeat(self, key: str, window_seconds: int) -> bool:
        """True if `key` was already seen in the last `window_seconds`.
        If not, it is remembered now and False is returned."""
        with self._lock:
            now = self.clock()
            last_time = self._last_seen.get(key)
            if last_time is not None and now - last_time < window_seconds:
                return True
            self._last_seen[key] = now
            self._forget_old_keys(now)
            return False

    def reset(self) -> None:
        """Forget everything (used between tests)."""
        with self._lock:
            self._hits.clear()
            self._windows.clear()
            self._last_seen.clear()

    def _forget_old_keys(self, now: float) -> None:
        # Without this the dicts would grow forever, one entry per visitor.
        if len(self._hits) + len(self._last_seen) < CLEANUP_THRESHOLD:
            return
        oldest_useful = now - LONGEST_WINDOW_SECONDS
        # A key whose own window is longer (suggestions are counted per hour)
        # is kept for that whole window, so its limit is not forgotten early.
        self._hits = {
            key: moments
            for key, moments in self._hits.items()
            if moments[-1] > min(oldest_useful, now - self._windows.get(key, 0))
        }
        self._windows = {key: self._windows[key] for key in self._hits if key in self._windows}
        self._last_seen = {
            key: moment for key, moment in self._last_seen.items() if moment > oldest_useful
        }


# The one limiter shared by the whole application.
limiter = RateLimiter()


def get_client_ip(request: Request) -> str:
    """The caller's IP address.

    Behind a proxy, the direct connection comes from the proxy, and the real
    client is listed in X-Forwarded-For. That header is only believed when
    TRUST_PROXY=true, because without a proxy the client could write anything
    in it. Even then we count PROXY_HOPS entries from the RIGHT (see
    config.py): the left side of the header is whatever the client sent.
    """
    if settings.trust_proxy:
        forwarded_for = request.headers.get("x-forwarded-for", "")
        addresses = [part.strip() for part in forwarded_for.split(",") if part.strip()]
        hops = max(1, settings.proxy_hops)
        if len(addresses) >= hops:
            return addresses[-hops]
    return request.client.host if request.client else "unknown"


def enforce_limit(key: str, limit: int, window_seconds: int = ONE_MINUTE) -> None:
    wait_seconds = limiter.seconds_to_wait(key, limit, window_seconds)
    if wait_seconds > 0:
        raise HTTPException(
            status_code=429,
            detail=f"Too many requests. Try again in {wait_seconds} seconds.",
            headers={"Retry-After": str(wait_seconds)},
        )


# ----- FastAPI dependencies: add to a route with dependencies=[Depends(...)] -----


def limit_contact_events(request: Request) -> None:
    """30 contact events per minute per IP."""
    enforce_limit(f"contact-events:{get_client_ip(request)}", CONTACT_EVENTS_PER_MINUTE)


def limit_writes(request: Request) -> None:
    """20 per minute per IP, shared by the review and profile write routes."""
    enforce_limit(f"writes:{get_client_ip(request)}", WRITES_PER_MINUTE)


def limit_suggestions(request: Request) -> None:
    """5 per hour per IP. Stricter than other writes because no login is needed."""
    enforce_limit(f"suggestions:{get_client_ip(request)}", SUGGESTIONS_PER_HOUR, ONE_HOUR)


def is_repeated_contact_event(request: Request, provider_id: object, event_type: str) -> bool:
    """True if this IP already sent this event for this provider in the last
    10 minutes. Stops refreshing a profile from inflating its view count."""
    key = f"{get_client_ip(request)}:{provider_id}:{event_type}"
    return limiter.is_repeat(key, CONTACT_EVENT_DEDUP_SECONDS)
