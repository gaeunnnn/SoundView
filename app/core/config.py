from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional

class Settings(BaseSettings):
    # API 설정
    PROJECT_NAME: str = "SoundView_AI_Server"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    
    # AWS S3 설정
    AWS_S3_ENDPOINT: str     # 예: https://s3.ap-northeast-2.amazonaws.com (또는 MinIO URL)
    AWS_S3_ACCESS_KEY: str
    AWS_S3_SECRET_KEY: str
    AWS_S3_BUCKET_NAME: str = "results"
    
    # Spring Boot 설정
    SPRING_BOOT_API_URL: str

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

    # S3의 기본 URL
    S3_BASE_URL: str


    @property
    def rabbitmq_url(self) -> str:
        return f"amqp://{self.RABBITMQ_USER}:{self.RABBITMQ_PASSWORD}@{self.RABBITMQ_HOST}:{self.RABBITMQ_PORT}/"


settings = Settings()
