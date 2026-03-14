from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://kawkaw:changeme@postgres:5432/kawkaw"

    # Redis
    REDIS_URL: str = "redis://redis:6379/0"

    # JWT
    JWT_SECRET_KEY: str = "change-me"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    # Media
    MEDIA_ROOT: str = "/mnt/media"
    THUMBS_ROOT: str = "/mnt/thumbs"
    THUMBS_URL_PREFIX: str = "/media/thumbs"

    # Seed admin
    ADMIN_USERNAME: str = "admin"
    ADMIN_PASSWORD: str = "changeme"

    # PostgreSQL (used by alembic env.py)
    POSTGRES_USER: str = "kawkaw"
    POSTGRES_PASSWORD: str = "changeme"
    POSTGRES_DB: str = "kawkaw"


settings = Settings()
