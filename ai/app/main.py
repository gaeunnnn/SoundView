from contextlib import asynccontextmanager
from fastapi import FastAPI
from app.core.config import settings
from app.api.v1.api import api_router

from app.core.rabbitmq import rabbitmq_client
from app.services.mq_handler import process_mq_message
import logging

logger = logging.getLogger(__name__)

# 수명주기(lifespan) 관리 함수 정의
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("RabbitMQ 연결 및 Consumer 구동 준비...")

    # 싱글톤 클라이언트 연결
    await rabbitmq_client.connect()

    # 첫번째 큐 구독
    await rabbitmq_client.consume(process_mq_message, queue_name=settings.RABBITMQ_QUEUE_NAME)

    yield

    logger.info("RabbitMQ 연결 안전하게 해제 중...")
    await rabbitmq_client.close()

def create_app() -> FastAPI:
    """
    FastAPI 앱 인스턴스를 생성하고 설정을 초기화합니다.
    """
    app = FastAPI(
        title=settings.PROJECT_NAME,
        version=settings.VERSION,
        openapi_url=f"{settings.API_V1_STR}/openapi.json",
        lifespan=lifespan
    )
    
    # API 라우터 등록
    app.include_router(api_router, prefix=settings.API_V1_STR)
    
    @app.get("/")
    async def root() -> dict[str, str]:
        return {"message": f"Welcome to {settings.PROJECT_NAME}"}
        
    return app

app = create_app()
