from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional

class Settings(BaseSettings):
    # API 설정
    PROJECT_NAME: str = "FastAPI AI Server"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    
    # AI 서비스 설정 (예시)
    OPENAI_API_KEY: Optional[str] = None
    GEMINI_API_KEY: Optional[str] = None
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True
    )

settings = Settings()
