"""Application settings.

Values come from environment variables, or from a `.env` file in `backend/`
(environment variables win). See `.env.example` for the full list.
"""

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Default points at the local Docker database from docker-compose.yml.
    database_url: str = "postgresql+psycopg://haddak:haddak@localhost:5433/haddak"

    # Token verification. If SUPABASE_JWKS_URL is set we verify tokens with
    # Supabase's public keys; otherwise we use the shared HS256 secret.
    supabase_jwt_secret: str = ""
    supabase_jwks_url: str = ""

    # Secret sent in the X-Admin-Key header for /admin routes.
    admin_api_key: str = ""

    # Comma-separated list of allowed browser origins, or "*" for any.
    cors_origins: str = "*"

    @field_validator("database_url")
    @classmethod
    def use_psycopg3_driver(cls, value: str) -> str:
        # Hosting providers hand out URLs starting with "postgresql://" or
        # "postgres://". SQLAlchemy would then look for the old psycopg2
        # driver, so we point it at psycopg version 3, which is what we install.
        for prefix in ("postgresql://", "postgres://"):
            if value.startswith(prefix):
                return "postgresql+psycopg://" + value[len(prefix) :]
        return value

    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


settings = Settings()
