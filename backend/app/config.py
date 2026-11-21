"""Application settings.

Values come from environment variables, or from a `.env` file in `backend/`
(environment variables win). See `.env.example` for the full list.
"""

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Values copied from .env.example start with this; they are not real secrets.
PLACEHOLDER_PREFIX = "change-me"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # "development" or "production". In production the app refuses to start
    # with missing or placeholder secrets (see production_problems below).
    environment: str = "development"

    # Default points at the local Docker database from docker-compose.yml.
    database_url: str = "postgresql+psycopg://haddak:haddak@localhost:5433/haddak"

    # Token verification (see app/auth.py).
    # Real sign-ins: Supabase signs tokens with a private key (ES256/RS256) and
    # publishes the public keys at this URL.
    supabase_jwks_url: str = ""
    # Development tokens (scripts/dev_token.py) are HS256, signed with this
    # secret. They are accepted only when allow_dev_tokens is also true, which
    # must never be the case in production (the app refuses to start).
    supabase_jwt_secret: str = ""
    allow_dev_tokens: bool = False

    # Secret sent in the X-Admin-Key header for /admin routes.
    admin_api_key: str = ""

    # Comma-separated list of allowed browser origins, or "*" for any.
    cors_origins: str = "*"

    # Set to true only when the API runs behind a proxy / load balancer that
    # sets the X-Forwarded-For header (most hosting platforms do). Then the
    # client's IP is read from that header. If this is true WITHOUT such a
    # proxy, anyone can fake their IP and dodge the rate limits.
    trust_proxy: bool = False

    # How many proxies sit in front of the API. Each proxy APPENDS the address
    # it received the request from, so the header looks like
    #   "whatever-the-client-typed, real-client-ip, proxy-1-ip"
    # Only the last PROXY_HOPS entries were written by proxies we trust; we
    # read the client IP from that position, counting from the right. Entries
    # further left can be faked by the client and are ignored.
    proxy_hops: int = 1

    # ----- Assistant (POST /assist, see docs/AI_ASSISTANT.md) -----
    # Read from the environment (or .env) only, never written to logs.
    # Empty = the assistant answers "unavailable" and the app falls back to
    # normal search.
    anthropic_api_key: str = ""
    # The cheapest model on purpose (the founder's choice). Switch to
    # "claude-sonnet-5-5" only if the phrase test shows Haiku misses too much.
    assist_model: str = "claude-haiku-5-5"
    # Model for Arabizi sentences (Lebanese Arabic in Latin letters), which
    # Haiku misreads more often. Empty = no routing, ASSIST_MODEL for all.
    assist_model_arabizi: str = "claude-sonnet-5-5"
    # Free AI requests per day (Lebanon time), see app/services/assist/quota.py.
    # Requests answered without the AI do not count, and over the allowance
    # the free keyword search answers instead: nobody is ever blocked.
    # A signed-in account:
    assist_daily_limit_signed_in: int = 30
    # A phone that is not signed in (identified by the app's random install id):
    assist_daily_limit_anonymous: int = 15
    # Everyone behind one IP address together. Higher, because many phones on
    # Alfa and Touch share one public address.
    assist_daily_limit_per_ip: int = 100
    # Spending caps in US dollars: per day (Lebanon time), so one bad day
    # cannot use up the month, and per calendar month (UTC).
    assist_daily_budget_usd: float = 1.0
    assist_monthly_budget_usd: float = 10.0
    # Secret for hashing who used the allowance (never stored in clear).
    # Any long random string; changing it only resets today's counts.
    assist_quota_secret: str = ""

    # ----- Operations -----
    # Sentry crash reports (app/error_tracking.py). Empty = off.
    sentry_dsn: str = ""
    # The address shown on /privacy, /terms and /delete-account
    # (app/legal_pages.py). Google Play requires a way to reach the developer.
    contact_email: str = ""

    @field_validator("database_url")
    @classmethod
    def use_psycopg3_driver(cls, value: str) -> str:
        # Forgive the usual copy-paste extras in a hosting dashboard: spaces,
        # a line break, quotes, or the whole "DATABASE_URL=..." line.
        value = value.strip().strip("\"'").strip()
        if value.upper().startswith("DATABASE_URL="):
            value = value[len("DATABASE_URL=") :].strip().strip("\"'")
        # Hosting providers hand out URLs starting with "postgresql://" or
        # "postgres://". SQLAlchemy would then look for the old psycopg2
        # driver, so we point it at psycopg version 3, which is what we install.
        for prefix in ("postgresql://", "postgres://"):
            if value.startswith(prefix):
                return "postgresql+psycopg://" + value[len(prefix) :]
        return value

    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    def is_production(self) -> bool:
        return self.environment.strip().lower() == "production"


def is_real_secret(value: str) -> bool:
    """False for an empty value or one still copied from .env.example."""
    value = value.strip()
    return value != "" and not value.lower().startswith(PLACEHOLDER_PREFIX)


def production_problems(settings: Settings) -> list[str]:
    """Reasons this configuration is unsafe for production (empty = fine)."""
    if not settings.is_production():
        return []

    problems = []
    # Checked here, with a message that never repeats the value (it holds a password).
    if not settings.database_url.startswith("postgresql+psycopg://"):
        problems.append(
            "DATABASE_URL is not a database address: it must start with postgresql://"
            " (paste only the value, without the name, quotes or other text)"
        )
    if not is_real_secret(settings.admin_api_key):
        problems.append("ADMIN_API_KEY is empty or still a placeholder")
    if settings.supabase_jwks_url.strip() == "":
        problems.append("SUPABASE_JWKS_URL is empty, so no real sign-in would work")
    if settings.allow_dev_tokens:
        problems.append("ALLOW_DEV_TOKENS must be false")
    if not is_real_secret(settings.assist_quota_secret):
        problems.append("ASSIST_QUOTA_SECRET is empty or still a placeholder")
    return problems


def check_startup_settings(settings: Settings) -> None:
    """Called once when the app starts. Better to fail loudly at startup than
    to run in production with an admin key anyone could guess."""
    problems = production_problems(settings)
    if problems:
        raise RuntimeError("Refusing to start in production: " + "; ".join(problems))


settings = Settings()
