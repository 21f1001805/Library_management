from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "MAY2026 Team 041 API"
    app_env: str = "development"
    api_prefix: str = "/api/v1"
    database_url: str = Field(
        default="postgresql://app:app@localhost:5432/app",
        validation_alias="DATABASE_URL",
    )
    backend_cors_origins: list[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]
    jwt_secret: str = Field(
        default="dev-secret-change-me-32-bytes-minimum", validation_alias="JWT_SECRET"
    )
    jwt_algorithm: str = "HS256"
    google_client_id: str = Field(default="", validation_alias="GOOGLE_CLIENT_ID")
    openai_api_key: str = Field(default="", validation_alias="OPENAI_API_KEY")
    openai_model: str = Field(default="gpt-4o-mini", validation_alias="OPENAI_MODEL")
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 7
    reset_token_expire_minutes: int = 30
    frontend_url: str = Field(default="http://localhost:5173", validation_alias="FRONTEND_URL")

    # Left blank in dev — mail.py logs to console instead of sending when smtp_host is unset.
    smtp_host: str = Field(default="", validation_alias="SMTP_HOST")
    smtp_port: int = Field(default=587, validation_alias="SMTP_PORT")
    smtp_user: str = Field(default="", validation_alias="SMTP_USER")
    smtp_password: str = Field(default="", validation_alias="SMTP_PASSWORD")
    smtp_from: str = Field(default="", validation_alias="SMTP_FROM")
    smtp_use_tls: bool = Field(default=True, validation_alias="SMTP_USE_TLS")

    model_config = SettingsConfigDict(
        env_file=("../.env", ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()
