from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional

class Settings(BaseSettings):
    # API 설정
    PROJECT_NAME: str = "SoundView_AI_Server"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    
    # MinIO 설정 - 반드시 .env 파일 또는 환경 변수로 주입 필요 (기본값 없음)
    MINIO_ENDPOINT: str = "localhost:9000"
    MINIO_ACCESS_KEY: str  # 기본값 제거 - 없으면 ValidationError 발생
    MINIO_SECRET_KEY: str  # 기본값 제거 - 없으면 ValidationError 발생
    MINIO_SECURE: bool = False
    
    # Spring Boot 설정
    SPRING_BOOT_API_URL: str = "http://localhost:8080"

    # 분석 결과 저장 경로 (임시 로컬 저장 - 추후 MinIO 업로드로 전환 예정)
    RESULT_SAVE_DIR: str = "./results"
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True
    )

    # rabbitMQ 세팅
    RABBITMQ_HOST: str
    RABBITMQ_PORT: int
    RABBITMQ_USER: str
    RABBITMQ_PASSWORD: str
    RABBITMQ_QUEUE_NAME: str

    @property
    def rabbitmq_url(self) -> str:
        return f"amqp://{self.RABBITMQ_USER}:{self.RABBITMQ_PASSWORD}@{self.RABBITMQ_HOST}:{self.RABBITMQ_PORT}/"


settings = Settings()
