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

    # Apply Alembic migrations from the app's own startup hook. Convenient on a
    # workstation, wrong under multiple uvicorn workers — they would race each
    # other for the same schema lock. In Docker a one-shot `migrate` service
    # runs them first and this is switched off.
    RUN_MIGRATIONS_ON_STARTUP: bool = True

    # Security. Sessions are signed with this; changing it logs everyone out.
    # Generate with: openssl rand -hex 32
    SECRET_KEY: str = "change_me_in_production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days

    # OCR
    # Turkish only. Adding "+eng" makes Tesseract run both language models and
    # reconcile them, which on Turkish invoices costs time and loses fields —
    # measured 27/32 against 28/32 for "tur" alone. Set OCR_LANG="tur+eng" if a
    # company genuinely receives English documents.
    OCR_LANG: str = "tur"
    # Where the language models live. Empty means backend/tessdata_browser:
    # the very Turkish model the in-browser scan loads (web/public/tessdata),
    # so both scan modes read with the same model (2026-09-24). backend/tessdata
    # still carries tessdata_best's larger model; set OCR_TESSDATA_DIR=tessdata
    # to go back to it (on synthetic invoices it read 107/136 held-out fields
    # against 101/136). A relative path is taken from the backend folder. Any
    # language in OCR_LANG that the folder lacks falls back to the system's.
    OCR_TESSDATA_DIR: str = ""
    # The browser reads a photo as it is; so does the server, by default.
    # True restores the server's old clean-up before reading: grayscale,
    # upscale anything narrower than 1600 px, stretch the contrast.
    OCR_PREPROCESS: bool = False

    # ── AI provider ────────────────────────────────────────────────────
    # Which vendor answers the assistant and the agent. Empty auto-selects:
    # OpenAI when OPENAI_API_KEY is set, else Gemini, else nothing — and with
    # nothing configured both surfaces answer offline from the local BM25
    # knowledge base, which is a supported configuration, not a failure.
    # Set "offline" to force that path even with a key present.
    # See services/llm.py; switching vendors is an .env edit, not a code change.
    AI_PROVIDER: str = ""  # "" (auto) | openai | gemini | offline

    OPENAI_API_KEY: str = ""
    # Empty falls back to llm.OPENAI_MODEL_DEFAULT.
    OPENAI_MODEL: str = ""
    # Reasoning models only: none | low | medium | high. Empty sends nothing and
    # lets the model default. The agent's own tool loop is its reasoning, and a
    # reasoning model refuses function tools unless this is "none" — llm.py
    # repairs that on the fly, so this exists to set it deliberately rather than
    # to make tool calls work.
    OPENAI_REASONING_EFFORT: str = ""
    # Any OpenAI-compatible gateway (Azure OpenAI, OpenRouter, LiteLLM, Ollama).
    # Empty means api.openai.com. Setting this alone is enough to go online when
    # AI_PROVIDER=openai — a local gateway needs no key.
    OPENAI_BASE_URL: str = ""

    GEMINI_API_KEY: str = ""
    # Empty falls back to llm.GEMINI_MODEL_DEFAULT.
    GEMINI_MODEL: str = ""

    # ── Bank integration ───────────────────────────────────────────────
    # Empty is a supported configuration: with no provider set, /api/bank
    # reports "not configured" and the CSV statement import still works. That
    # is the offline-first promise — a bank connection adds a convenience, it
    # is never what the feature depends on.
    #
    # Hostnames, paths and scopes are issued with the credentials rather than
    # published, so they belong here and not in the code. See
    # services/bank_providers.py for the presets and the field-map override.
    BANK_PROVIDER: str = ""  # custom | mock | garanti | isbank | akbank | …
    BANK_AUTH_STYLE: str = ""  # overrides the preset's style when set
    BANK_API_BASE_URL: str = ""
    BANK_TOKEN_URL: str = ""
    BANK_SCOPE: str = ""
    BANK_CLIENT_ID: str = ""
    BANK_CLIENT_SECRET: str = ""
    BANK_API_KEY: str = ""
    BANK_API_KEY_HEADER: str = ""
    BANK_ACCESS_TOKEN: str = ""
    BANK_CONSENT_ID: str = ""
    BANK_ACCOUNTS_PATH: str = ""
    BANK_TRANSACTIONS_PATH: str = ""
    BANK_SINCE_PARAM: str = ""
    BANK_UNTIL_PARAM: str = ""
    BANK_DATE_FORMAT: str = ""
    # JSON objects. Headers the gateway requires (channel code, request id…)
    # and per-field key overrides for a response shape the defaults miss.
    BANK_EXTRA_HEADERS: str = ""
    BANK_FIELD_MAP: str = ""
    # Mutual TLS — PEM paths inside the container.
    BANK_CLIENT_CERT: str = ""
    BANK_CLIENT_KEY: str = ""
    BANK_CA_BUNDLE: str = ""
    # Only ever false against a bank's own sandbox with a self-signed chain.
    BANK_VERIFY_TLS: bool = True
    BANK_TIMEOUT_SECONDS: float = 20.0

    # ── Compute layer ──────────────────────────────────────────────────
    # /api/compute reads no table, so it needs an identity but not a company.
    # Set false only for an offline demo: the endpoints then accept
    # unauthenticated calls. Never do this on a deployment anyone can reach.
    COMPUTE_AUTH_REQUIRED: bool = True

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
