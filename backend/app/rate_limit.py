"""Rate limiting, as described in the "Rate limits" section of docs/API.md.

Who is counted ("the caller"):
  - a signed-in user is counted by user id, so the many phones that share
    one carrier address (Alfa and Touch use carrier-grade NAT) do not share
    one allowance;
  - everyone else is counted by IP address (an IPv6 address by its /64
    network, because one home or phone gets a whole /64);
  - signed in or not, each IP address also has a much higher "backstop"
    limit, so one machine with many accounts cannot get unlimited requests.

LIMITATION: everything here lives in this process's memory (plain dicts).
It is forgotten when the server restarts, and each server process keeps its
own counts. That is fine while the API runs as ONE instance with one worker.
If it is ever scaled to several, the limits become "per instance" and this
should move to a shared store. (The contact-event "same tap twice" rule is
NOT here: it lives in the database, see app/services/contact_stats.py.)
"""

import ipaddress
import logging
import math
import threading
import time
import uuid
from collections.abc import Callable

from fastapi import Depends, HTTPException, Request

from app.auth import get_optional_user_id
from app.config import settings

logger = logging.getLogger("haddak.rate_limit")

# Limits from docs/API.md, per caller (user id when signed in, else IP).
CONTACT_EVENTS_PER_MINUTE = 30
WRITES_PER_MINUTE = 20
SUGGESTIONS_PER_HOUR = 5
REPORTS_PER_HOUR = 10
CLAIMS_PER_HOUR = 5
# Far more than anyone can type; stops a script hammering the assistant. The
# AI's own daily allowance is separate (app/services/assist/quota.py).
ASSIST_REQUESTS_PER_MINUTE = 20
# Public reads. Generous: a person scrolling fast makes a few per second at
# most. They stop a script from emptying the database connection pool or
# copying every listing.
SEARCHES_PER_MINUTE = 120  # search and stories near me (the costly queries)
READS_PER_MINUTE = 300  # a profile, its reviews and stories, categories

# The backstop for one IP address, whoever is signed in behind it: this many
# times the per-caller limit.
IP_BACKSTOP_FACTOR = 10

ONE_MINUTE = 60
ONE_HOUR = 60 * 60

# When this many keys are remembered, forget the ones that are too old to matter.
CLEANUP_THRESHOLD = 10_000
# Keys counted per minute are dropped after this; hourly keys are kept for
# their own window (see _forget_old_keys).
LONGEST_WINDOW_SECONDS = ONE_MINUTE


class RateLimiter:
    """Remembers when things happened, per key (e.g. "writes:ip:1.2.3.4").

    `clock` is a function returning the current time in seconds. Tests replace
    it with a fake clock so they can "wait" ten minutes instantly.
    """

    def __init__(self, clock: Callable[[], float] = time.monotonic):
        self.clock = clock
        self._hits: dict[str, list[float]] = {}  # key -> times of recent requests
        self._windows: dict[str, int] = {}  # key -> the window it is counted over
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

    def reset(self) -> None:
        """Forget everything (used between tests)."""
        with self._lock:
            self._hits.clear()
            self._windows.clear()

    def _forget_old_keys(self, now: float) -> None:
        # Without this the dicts would grow forever, one entry per visitor.
        if len(self._hits) < CLEANUP_THRESHOLD:
            return
        oldest_useful = now - LONGEST_WINDOW_SECONDS
        # A key whose own window is longer (suggestions and reports are counted per hour)
        # is kept for that whole window, so its limit is not forgotten early.
        self._hits = {
            key: moments
            for key, moments in self._hits.items()
            if moments[-1] > min(oldest_useful, now - self._windows.get(key, 0))
        }
        self._windows = {key: self._windows[key] for key in self._hits if key in self._windows}


# The one limiter shared by the whole application.
limiter = RateLimiter()


# Logged once per process: how many X-Forwarded-For entries arrive (a count,
# never the addresses), so PROXY_HOPS can be checked in the host's logs.
_forwarded_for_logged = False


def log_forwarded_for_shape(entry_count: int) -> None:
    global _forwarded_for_logged
    if _forwarded_for_logged:
        return
    _forwarded_for_logged = True
    logger.info(
        "X-Forwarded-For carries %d entries; PROXY_HOPS=%d reads entry %d from the right",
        entry_count,
        settings.proxy_hops,
        max(1, settings.proxy_hops),
    )


def limit_address(ip: str) -> str:
    """The address as the limits count it: IPv4 as it is, IPv6 cut to its
    /64 network (every home or phone gets a whole /64, so counting single
    IPv6 addresses would give one person billions of allowances)."""
    try:
        address = ipaddress.ip_address(ip)
    except ValueError:
        return ip  # "unknown", or the test client's name
    if isinstance(address, ipaddress.IPv6Address):
        if address.ipv4_mapped is not None:  # ::ffff:1.2.3.4 is really IPv4
            return str(address.ipv4_mapped)
        return str(ipaddress.ip_network(f"{address}/64", strict=False))
    return str(address)


def get_client_ip(request: Request) -> str:
    """The caller's IP address, as the limits count it (see limit_address).

    Behind a proxy, the direct connection comes from the proxy, and the real
    client is listed in X-Forwarded-For. That header is only believed when
    TRUST_PROXY=true, because without a proxy the client could write anything
    in it. Even then we count PROXY_HOPS entries from the RIGHT (see
    config.py): the left side of the header is whatever the client sent.
    """
    if settings.trust_proxy:
        forwarded_for = request.headers.get("x-forwarded-for", "")
        addresses = [part.strip() for part in forwarded_for.split(",") if part.strip()]
        log_forwarded_for_shape(len(addresses))
        hops = max(1, settings.proxy_hops)
        if len(addresses) >= hops:
            return limit_address(addresses[-hops])
    return limit_address(request.client.host if request.client else "unknown")


def enforce_limit(key: str, limit: int, window_seconds: int = ONE_MINUTE) -> None:
    wait_seconds = limiter.seconds_to_wait(key, limit, window_seconds)
    if wait_seconds > 0:
        raise HTTPException(
            status_code=429,
            detail=f"Too many requests. Try again in {wait_seconds} seconds.",
            headers={"Retry-After": str(wait_seconds)},
        )


def enforce_caller_limit(
    name: str,
    request: Request,
    user_id: uuid.UUID | None,
    limit: int,
    window_seconds: int = ONE_MINUTE,
) -> None:
    """`limit` per caller: per user id when signed in, else per IP.

    A signed-in caller's IP address is counted too, against the much higher
    backstop (IP_BACKSTOP_FACTOR times `limit`).
    """
    ip = get_client_ip(request)
    if user_id is None:
        enforce_limit(f"{name}:ip:{ip}", limit, window_seconds)
        return
    enforce_limit(f"{name}:user:{user_id}", limit, window_seconds)
    enforce_limit(f"{name}:ip-backstop:{ip}", limit * IP_BACKSTOP_FACTOR, window_seconds)


# ----- FastAPI dependencies: add to a route with dependencies=[Depends(...)] -----
# Each one reads the (optional) signed-in user. FastAPI resolves
# get_optional_user_id once per request, however many dependencies ask for it.
# A missing or bad token counts as "not signed in"; routes that need a login
# still answer 401 afterwards.


def limit_contact_events(
    request: Request, user_id: uuid.UUID | None = Depends(get_optional_user_id)
) -> None:
    """30 contact events per minute per caller."""
    enforce_caller_limit("contact-events", request, user_id, CONTACT_EVENTS_PER_MINUTE)


def limit_writes(
    request: Request, user_id: uuid.UUID | None = Depends(get_optional_user_id)
) -> None:
    """20 per minute per caller, shared by the review, profile, story, banner,
    follow, hire-check and account write routes."""
    enforce_caller_limit("writes", request, user_id, WRITES_PER_MINUTE)


def limit_suggestions(
    request: Request, user_id: uuid.UUID | None = Depends(get_optional_user_id)
) -> None:
    """5 per hour per caller. Stricter than other writes because no login is needed."""
    enforce_caller_limit("suggestions", request, user_id, SUGGESTIONS_PER_HOUR, ONE_HOUR)


def limit_reports(
    request: Request, user_id: uuid.UUID | None = Depends(get_optional_user_id)
) -> None:
    """10 per hour per caller. Like suggestions: no login, so a stricter limit."""
    enforce_caller_limit("reports", request, user_id, REPORTS_PER_HOUR, ONE_HOUR)


def limit_claims(
    request: Request, user_id: uuid.UUID | None = Depends(get_optional_user_id)
) -> None:
    """5 per hour per caller. Claims are rare (one per business), so a strict limit."""
    enforce_caller_limit("claims", request, user_id, CLAIMS_PER_HOUR, ONE_HOUR)


def limit_assist(
    request: Request, user_id: uuid.UUID | None = Depends(get_optional_user_id)
) -> None:
    """20 per minute per caller, every assistant request (with or without AI)."""
    enforce_caller_limit("assist", request, user_id, ASSIST_REQUESTS_PER_MINUTE)


def limit_searches(
    request: Request, user_id: uuid.UUID | None = Depends(get_optional_user_id)
) -> None:
    """120 per minute per caller: search and stories near me."""
    enforce_caller_limit("searches", request, user_id, SEARCHES_PER_MINUTE)


def limit_reads(
    request: Request, user_id: uuid.UUID | None = Depends(get_optional_user_id)
) -> None:
    """300 per minute per caller: a profile, its reviews and stories, categories."""
    enforce_caller_limit("reads", request, user_id, READS_PER_MINUTE)
