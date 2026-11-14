"""Print a login token for local development, before Supabase exists.

    python scripts/dev_token.py                      # new random user
    python scripts/dev_token.py <user-uuid>          # a specific user
    python scripts/dev_token.py <user-uuid> --days 7

The token is signed with SUPABASE_JWT_SECRET (HS256) and looks like the ones
Supabase issues, so the API accepts it as:  Authorization: Bearer <token>
It only works while SUPABASE_JWKS_URL is empty.
"""

import argparse
import sys
import uuid
from datetime import UTC, datetime, timedelta
from pathlib import Path

import jwt

# Allow `python scripts/dev_token.py` to import the `app` package.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.auth import TOKEN_AUDIENCE  # noqa: E402
from app.config import settings  # noqa: E402


def make_token(user_id: uuid.UUID, days_valid: int) -> str:
    now = datetime.now(UTC)
    claims = {
        "sub": str(user_id),
        "aud": TOKEN_AUDIENCE,
        "role": "authenticated",
        "iat": now,
        "exp": now + timedelta(days=days_valid),
    }
    return jwt.encode(claims, settings.supabase_jwt_secret, algorithm="HS256")


def main() -> None:
    parser = argparse.ArgumentParser(description="Print a development login token.")
    parser.add_argument("user_id", nargs="?", help="user UUID (default: a new random one)")
    parser.add_argument("--days", type=int, default=30, help="days until it expires")
    args = parser.parse_args()

    if not settings.supabase_jwt_secret:
        sys.exit("SUPABASE_JWT_SECRET is not set. Copy .env.example to .env first.")

    user_id = uuid.UUID(args.user_id) if args.user_id else uuid.uuid4()
    # Notes go to stderr, so `python scripts/dev_token.py > token.txt` saves only the token.
    print(f"user id: {user_id} (valid {args.days} days)", file=sys.stderr)
    print(make_token(user_id, args.days))


if __name__ == "__main__":
    main()
