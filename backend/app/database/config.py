from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    DATABASE_URL: str = "mysql+pymysql://root:YOUR_PASSWORD@localhost:3306/dynamic_form_builder"
    FRONTEND_URL: str = "http://localhost:5173"
    BACKEND_HOST: str = "0.0.0.0"
    BACKEND_PORT: int = 8000
    ADMIN_USERNAME: str | None = None
    ADMIN_PASSWORD_HASH: str | None = None
    ADMIN_SECRET_KEY: str | None = None
    ADMIN_SESSION_TTL_SECONDS: int = 28800
    ADMIN_COOKIE_SECURE: bool = False

    model_config = SettingsConfigDict(
        env_file=BASE_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()
