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


def decode_user_id(token: str) -> uuid.UUID:
    """Return the user id inside a valid token. Raises on any problem."""
    required_claims = {"require": ["sub", "exp"]}

    if settings.supabase_jwks_url:
        signing_key = get_jwks_client().get_signing_key_from_jwt(token).key
        algorithms = ["ES256", "RS256"]
    else:
        if not settings.supabase_jwt_secret:
            raise ValueError("SUPABASE_JWT_SECRET is not configured")
        signing_key = settings.supabase_jwt_secret
        algorithms = ["HS256"]

    claims = jwt.decode(
        token,
        signing_key,
        algorithms=algorithms,
        audience=TOKEN_AUDIENCE,
        options=required_claims,
    )
    return uuid.UUID(claims["sub"])


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
