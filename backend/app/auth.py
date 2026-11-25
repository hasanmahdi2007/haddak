"""Who is calling? Login tokens for users, a shared key for the admin.

Supabase Auth issues the login token (a JWT). We never talk to Supabase per
request: we only check the token's signature and expiry, then read the user id
from its "sub" claim. The public keys that check the signature are downloaded
from SUPABASE_JWKS_URL now and then (see SigningKeys below).
"""

import hmac
import logging
import threading
import time
import uuid
from collections.abc import Callable
from functools import lru_cache

import jwt
from fastapi import Depends, Header, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.config import settings

logger = logging.getLogger("haddak.auth")

# Supabase puts this audience in every logged-in user's token.
TOKEN_AUDIENCE = "authenticated"

# The JWKS address is "<issuer>/.well-known/jwks.json" (the OpenID convention
# Supabase follows), so the expected "iss" claim is read from that address.
JWKS_SUFFIX = "/.well-known/jwks.json"

# Accept tokens up to 30 seconds "from the future" or "already expired": the
# server's clock and Supabase's are never exactly the same.
CLOCK_LEEWAY_SECONDS = 30

# auto_error=False: we raise our own 401 instead of FastAPI's default 403.
bearer_scheme = HTTPBearer(auto_error=False)


class SignInCheckUnavailable(Exception):
    """The public keys could not be downloaded and none are cached.

    This is OUR problem, not the user's: the token may be perfectly fine.
    It becomes a 503, never a 401, because the app signs the user out on 401.
    """


class SigningKeys:
    """Supabase's public signing keys, kept in memory.

    - Downloaded at most once per KEYS_LIFESPAN_SECONDS (Supabase announces
      new keys long before it uses them, so an hour-old copy is fine).
    - Each download may take at most FETCH_TIMEOUT_SECONDS.
    - If a download fails, the keys we already have stay in use, and the next
      attempt waits RETRY_AFTER_FAILURE_SECONDS. So a Supabase hiccup neither
      signs anyone out nor makes every request wait for a timeout.
    - A token with a key id we do not know triggers a download (a new key may
      have appeared), but at most once per UNKNOWN_KEY_COOLDOWN_SECONDS, so
      made-up key ids cannot make us download on every request.

    `fetch` returns the JWKS document (a dict); tests pass a fake one.
    """

    KEYS_LIFESPAN_SECONDS = 60 * 60
    FETCH_TIMEOUT_SECONDS = 5
    RETRY_AFTER_FAILURE_SECONDS = 30
    UNKNOWN_KEY_COOLDOWN_SECONDS = 30

    def __init__(
        self,
        fetch: Callable[[], dict],
        clock: Callable[[], float] = time.monotonic,
    ):
        self._fetch = fetch
        self._clock = clock
        self._keys: dict[str, jwt.PyJWK] = {}  # key id ("kid") -> key
        self._fetched_at: float | None = None  # last successful download
        self._failed_at: float | None = None  # last failed download
        # One download at a time (like `synchronized` in Java).
        self._lock = threading.Lock()

    def get_signing_key_from_jwt(self, token: str) -> jwt.PyJWK:
        key_id = jwt.get_unverified_header(token).get("kid")
        return self.key_for(key_id)

    def key_for(self, key_id: str | None) -> jwt.PyJWK:
        with self._lock:
            if self._should_download(key_id):
                self._download()
            if key_id in self._keys:
                return self._keys[key_id]
            if not self._keys or self._last_download_failed():
                # We cannot tell whether the token is good: say so honestly.
                raise SignInCheckUnavailable("Supabase's signing keys could not be downloaded")
            raise jwt.InvalidTokenError("Unknown signing key id")

    def _should_download(self, key_id: str | None) -> bool:
        now = self._clock()
        if self._failed_at is not None and now - self._failed_at < self.RETRY_AFTER_FAILURE_SECONDS:
            return False
        if self._fetched_at is None:
            return True
        age = now - self._fetched_at
        if age >= self.KEYS_LIFESPAN_SECONDS:
            return True
        return key_id not in self._keys and age >= self.UNKNOWN_KEY_COOLDOWN_SECONDS

    def _last_download_failed(self) -> bool:
        return self._failed_at is not None and (
            self._fetched_at is None or self._failed_at > self._fetched_at
        )

    def _download(self) -> None:
        try:
            key_set = jwt.PyJWKSet.from_dict(self._fetch())
            keys = {key.key_id: key for key in key_set.keys if key.key_id}
            if not keys:
                raise jwt.PyJWKClientError("The JWKS document has no keys with an id")
        except Exception as error:
            self._failed_at = self._clock()
            # Error level: this reaches Sentry. Only the error type and text,
            # which describe the download, never a token.
            logger.error(
                "could not download Supabase signing keys (%s); %s",
                type(error).__name__,
                "keeping the previous keys" if self._keys else "no keys yet",
            )
            return
        self._keys = keys
        self._fetched_at = self._clock()
        self._failed_at = None


def download_jwks() -> dict:
    """Fetch the JWKS document. PyJWKClient does the HTTP part (no redirects
    followed, https only); caching is ours, so it is switched off here."""
    client = jwt.PyJWKClient(
        settings.supabase_jwks_url,
        cache_jwk_set=False,
        timeout=SigningKeys.FETCH_TIMEOUT_SECONDS,
    )
    return client.fetch_data()


@lru_cache
def get_jwks_client() -> SigningKeys:
    """The one key store for the whole process."""
    return SigningKeys(download_jwks)


def expected_issuer() -> str | None:
    """The "iss" claim Supabase writes: https://<project>.supabase.co/auth/v1."""
    url = settings.supabase_jwks_url.strip()
    if url.endswith(JWKS_SUFFIX):
        return url[: -len(JWKS_SUFFIX)]
    return None


# Real Supabase tokens are signed with a private key; we check them with the
# matching public key from SUPABASE_JWKS_URL.
JWKS_ALGORITHMS = ["ES256", "RS256"]
# Development tokens (scripts/dev_token.py) are signed with a shared secret.
DEV_ALGORITHM = "HS256"


def decode_user_id(token: str) -> uuid.UUID:
    """Return the user id inside a valid token. Raises on any problem
    (SignInCheckUnavailable when the keys cannot be downloaded).

    The token's header names the algorithm it was signed with. We use that
    only to pick WHICH of our checks to run; each check then accepts only its
    own algorithms, so a token cannot talk us into a weaker one. "none"
    (an unsigned token) matches no check and is always refused.
    """
    algorithm = jwt.get_unverified_header(token).get("alg")

    required = ["sub", "exp"]
    issuer = None
    if algorithm in JWKS_ALGORITHMS and settings.supabase_jwks_url:
        signing_key = get_jwks_client().get_signing_key_from_jwt(token).key
        algorithms = JWKS_ALGORITHMS
        # A token from another Supabase project is refused even if its key
        # somehow matched (defence in depth).
        issuer = expected_issuer()
        if issuer:
            required.append("iss")
    elif algorithm == DEV_ALGORITHM and dev_tokens_allowed():
        signing_key = settings.supabase_jwt_secret
        algorithms = [DEV_ALGORITHM]
    else:
        raise ValueError(f"Token algorithm {algorithm!r} is not accepted here")

    claims = jwt.decode(
        token,
        signing_key,
        algorithms=algorithms,
        audience=TOKEN_AUDIENCE,
        issuer=issuer,
        leeway=CLOCK_LEEWAY_SECONDS,
        options={"require": required},
    )
    # Supabase can hand out "anonymous" accounts (no email). Haddak has no use
    # for them, and they would make throwaway accounts free.
    if claims.get("is_anonymous") is True:
        raise jwt.InvalidTokenError("Anonymous sign-ins are not accepted")
    return uuid.UUID(claims["sub"])


def dev_tokens_allowed() -> bool:
    """HS256 tokens signed with SUPABASE_JWT_SECRET (scripts/dev_token.py).

    Off unless ALLOW_DEV_TOKENS=true. Must stay off in production: anyone
    holding the secret could sign in as any user.
    """
    return settings.allow_dev_tokens and bool(settings.supabase_jwt_secret)


def unauthorized(message: str) -> HTTPException:
    return HTTPException(status_code=401, detail=message, headers={"WWW-Authenticate": "Bearer"})


def sign_in_check_unavailable() -> HTTPException:
    # Retry-After: the next key download is tried after this many seconds.
    return HTTPException(
        status_code=503,
        detail="Sign-in check unavailable, try again",
        headers={"Retry-After": str(SigningKeys.RETRY_AFTER_FAILURE_SECONDS)},
    )


def get_current_user_id(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> uuid.UUID:
    """Dependency for routes that need a logged-in user. 401 otherwise."""
    if credentials is None:
        raise unauthorized("Missing login token")
    try:
        return decode_user_id(credentials.credentials)
    except SignInCheckUnavailable as error:
        raise sign_in_check_unavailable() from error
    except Exception as error:
        # Bad signature, expired, wrong audience, sub is not a UUID, ...
        # Only the kind of error is logged, never the token itself.
        logger.warning("token rejected: %s", type(error).__name__)
        raise unauthorized("Invalid or expired login token") from error


def get_optional_user_id(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> uuid.UUID | None:
    """Dependency for public routes that behave slightly differently when
    logged in. A missing or bad token simply means "anonymous" (also when
    the keys cannot be checked right now: a public page should still work)."""
    if credentials is None:
        return None
    try:
        return decode_user_id(credentials.credentials)
    except SignInCheckUnavailable:
        return None  # already logged as an error by SigningKeys
    except Exception as error:
        logger.info("optional token ignored: %s", type(error).__name__)
        return None


def require_admin(x_admin_key: str | None = Header(default=None)) -> None:
    """Dependency for /admin routes: the X-Admin-Key header must match."""
    expected = settings.admin_api_key
    # compare_digest takes the same time whether the key is nearly right or
    # completely wrong, so the key cannot be guessed by timing responses.
    if (
        not expected
        or x_admin_key is None
        or not hmac.compare_digest(x_admin_key.encode(), expected.encode())
    ):
        raise HTTPException(status_code=401, detail="Invalid admin key")
