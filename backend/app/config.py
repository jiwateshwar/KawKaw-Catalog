from urllib.parse import quote
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # PostgreSQL — individual vars so passwords with special chars work
    POSTGRES_USER: str = "kawkaw"
    POSTGRES_PASSWORD: str = "changeme"
    POSTGRES_DB: str = "kawkaw"
    POSTGRES_HOST: str = "postgres"
    POSTGRES_PORT: int = 5432

    @property
    def DATABASE_URL(self) -> str:
        password = quote(self.POSTGRES_PASSWORD, safe="")
        return (
            f"postgresql+asyncpg://{self.POSTGRES_USER}:{password}"
            f"@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )

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


settings = Settings()
