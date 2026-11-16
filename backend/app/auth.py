"""Who is calling? Login tokens for users, a shared key for the admin.

Supabase Auth issues the login token (a JWT). We never talk to Supabase per
request: we only check the token's signature and expiry, then read the user id
from its "sub" claim.
"""

import hmac
import uuid
from functools import lru_cache

import jwt
from fastapi import Depends, Header, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.config import settings

# Supabase puts this audience in every logged-in user's token.
TOKEN_AUDIENCE = "authenticated"

# auto_error=False: we raise our own 401 instead of FastAPI's default 403.
bearer_scheme = HTTPBearer(auto_error=False)


@lru_cache
def get_jwks_client() -> jwt.PyJWKClient:
    """Downloads and caches Supabase's public signing keys."""
    return jwt.PyJWKClient(settings.supabase_jwks_url)


# Real Supabase tokens are signed with a private key; we check them with the
# matching public key from SUPABASE_JWKS_URL.
JWKS_ALGORITHMS = ["ES256", "RS256"]
# Development tokens (scripts/dev_token.py) are signed with a shared secret.
DEV_ALGORITHM = "HS256"


def decode_user_id(token: str) -> uuid.UUID:
    """Return the user id inside a valid token. Raises on any problem.

    The token's header names the algorithm it was signed with. We use that
    only to pick WHICH of our checks to run; each check then accepts only its
    own algorithms, so a token cannot talk us into a weaker one. "none"
    (an unsigned token) matches no check and is always refused.
    """
    algorithm = jwt.get_unverified_header(token).get("alg")

    if algorithm in JWKS_ALGORITHMS and settings.supabase_jwks_url:
        signing_key = get_jwks_client().get_signing_key_from_jwt(token).key
        algorithms = JWKS_ALGORITHMS
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
        options={"require": ["sub", "exp"]},
    )
    return uuid.UUID(claims["sub"])


def dev_tokens_allowed() -> bool:
    """HS256 tokens signed with SUPABASE_JWT_SECRET (scripts/dev_token.py).

    Off unless ALLOW_DEV_TOKENS=true. Must stay off in production: anyone
    holding the secret could sign in as any user.
    """
    return settings.allow_dev_tokens and bool(settings.supabase_jwt_secret)


def unauthorized(message: str) -> HTTPException:
    return HTTPException(status_code=401, detail=message, headers={"WWW-Authenticate": "Bearer"})


def get_current_user_id(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> uuid.UUID:
    """Dependency for routes that need a logged-in user. 401 otherwise."""
    if credentials is None:
        raise unauthorized("Missing login token")
    try:
        return decode_user_id(credentials.credentials)
    except Exception as error:
        # Bad signature, expired, wrong audience, sub is not a UUID, ...
        raise unauthorized("Invalid or expired login token") from error


def get_optional_user_id(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> uuid.UUID | None:
    """Dependency for public routes that behave slightly differently when
    logged in. A missing or bad token simply means "anonymous"."""
    if credentials is None:
        return None
    try:
        return decode_user_id(credentials.credentials)
    except Exception:
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
