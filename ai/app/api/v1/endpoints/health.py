from fastapi import APIRouter

router = APIRouter()

@router.get("/health")
async def health_check() -> dict[str, str]:
    """
    시스템 상태를 확인하는 헬스체크 엔드포인트입니다.
    """
    return {"status": "healthy"}
