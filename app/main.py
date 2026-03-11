from fastapi import FastAPI
from app.core.config import settings
from app.api.v1.api import api_router

def create_app() -> FastAPI:
    """
    FastAPI 앱 인스턴스를 생성하고 설정을 초기화합니다.
    """
    app = FastAPI(
        title=settings.PROJECT_NAME,
        version=settings.VERSION,
        openapi_url=f"{settings.API_V1_STR}/openapi.json"
    )
    
    # API 라운터 등록
    app.include_router(api_router, prefix=settings.API_V1_STR)
    
    @app.get("/")
    async def root() -> dict[str, str]:
        return {"message": f"Welcome to {settings.PROJECT_NAME}"}
        
    return app

app = create_app()
