from pydantic_settings import BaseSettings
from typing import List

class Settings(BaseSettings):
    DATABASE_URL: str
    REDIS_URL: str = "redis://localhost:6379/0"

    DEBUG: bool = False

    ALLOWED_ORIGINS: List[str] = ["http://localhost:3000"]

    class Config:
        extra = "ignore"

settings = Settings()
