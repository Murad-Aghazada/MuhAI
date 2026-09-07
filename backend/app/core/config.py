from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application configuration sourced from environment / .env file."""

    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    PROJECT_NAME: str = "Muhai API"
    API_PREFIX: str = "/api"

    # Database
    DATABASE_URL: str = (
        "postgresql+asyncpg://muhai:muhai_secret@localhost:5432/muhai"
    )

    # Redis / Celery
    REDIS_URL: str = "redis://localhost:6379/0"

    # Security
    SECRET_KEY: str = "change_me_in_production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days

    # OCR
    OCR_LANG: str = "tur+eng"

    # AI (Gemini). When empty, the chatbot uses the offline rule backend.
    GEMINI_API_KEY: str = ""

    # ── Firebase ───────────────────────────────────────────────────────
    # Firestore is the system of record; this API is a stateless compute
    # layer. Callers authenticate with a Firebase ID token, verified against
    # this project id. No service-account key is required.
    FIREBASE_PROJECT_ID: str = ""

    # Set to false only for an offline demo where Google's public signing
    # certificates are unreachable. Compute endpoints then accept unauthenticated
    # calls. Never do this on a deployment the jury (or anyone) can reach.
    FIREBASE_AUTH_REQUIRED: bool = True

    # CORS — comma-separated origins. Kept as a plain string so
    # pydantic-settings does not attempt to JSON-decode it; use
    # ``cors_origins`` for the parsed list.
    BACKEND_CORS_ORIGINS: str = (
        "http://localhost:5173,http://127.0.0.1:5173,"
        "http://localhost:4173,http://127.0.0.1:4173,"
        "http://localhost:8081,http://localhost:19006,exp://127.0.0.1:19000"
    )

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.BACKEND_CORS_ORIGINS.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
