from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional

class Settings(BaseSettings):
    # API 설정
    PROJECT_NAME: str = "FastAPI AI Server"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    
    # MinIO 설정
    MINIO_ENDPOINT: str = "localhost:9000"
    MINIO_ACCESS_KEY: str = "minioadmin"
    MINIO_SECRET_KEY: str = "minioadmin"
    MINIO_SECURE: bool = False
    
    # Spring Boot 설정
    SPRING_BOOT_API_URL: str = "http://localhost:8080"
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True
    )

settings = Settings()
