import httpx
from app.core.config import settings


class CallbackService:
    """
    외부 시스템(Spring Boot)으로 완료 콜백을 전송하는 서비스 클래스입니다.
    AI 처리 완료 여부와 무관하게 HTTP 통신 역할만 수행합니다.
    """

    async def notify_complete(self, video_id: str, subtitle_url: str, vibration_url: str) -> None:
        """
        Spring Boot 서버에 처리 완료를 통지합니다 (자막/진동 분리 URL 제공).
        """
        callback_url = f"{settings.SPRING_BOOT_API_URL}/videos/{video_id}/complete"
        print(f"Sending callback to Spring Boot: {callback_url}")

        payload = {
            "videoId": video_id,
            "subtitleUrl": subtitle_url,
            "vibrationUrl": vibration_url,
            "status": "COMPLETED"
        }

        async with httpx.AsyncClient() as client:
            try:
                # 실제 운영: 주석 해제하여 실제 호출
                # response = await client.put(callback_url, json=payload)
                # response.raise_for_status()
                print(f"Successfully notified Spring Boot for video {video_id}")
            except httpx.HTTPStatusError as e:
                # Spring Boot에서 오류 응답 시 예외 처리
                raise Exception(f"Spring Boot 콜백 실패 (HTTP {e.response.status_code}): {str(e)}")
            except Exception as e:
                raise Exception(f"Spring Boot 콜백 중 오류 발생: {str(e)}")
