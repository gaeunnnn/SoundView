import logging
from app.core.rabbitmq import rabbitmq_client   # MQ 클라이언트 임포트

logger = logging.getLogger(__name__)

class CallbackService:
    """
    외부 시스템(Spring Boot)로 완료 콜백을 전송하는 서비스 클래스.
    """

    async def notify_complete(self, video_id: str, subtitle_key: str, vibration_json_key: str, vibration_bin_key: str, sound_event_key: str, duration_sec: float):
        """
        Spring Boot가 구독 중인 'result_queue'에 처리 완료 상태와 결과 S3 Key를 담은 메시지를 발행합니다.
        """
        logger.info(f"[CallbackService] 비디오 {video_id} 처리 완료. Spring Boot로 MQ 전송을 준비합니다.")

        # 1. SpringBoot로 보낼 최종 완료 메시지 페이로드 구성
        result_payload = {
            "videoId" : video_id,
            "status" : "SUCCESS",
            "durationSec" : duration_sec,
            "result" : {
                "subtitleKey" : subtitle_key,
                "vibrationKey" : vibration_json_key,
                "vibrationBinKey" : vibration_bin_key,
                "soundEventKey" : sound_event_key
            }
        }

        try:
            # 2. 공통화된 함수를 사용하여 'result_queue'로 발행
            await rabbitmq_client.send_message(
                message=result_payload,
                queue_name= "FS_queue"
            )
            logger.info(f"✅ Spring Boot 연동 완료: 'FS_queue'에 완료 메시지 발행 성공 (Video ID: {video_id})")
            
        except Exception as e:
            logger.error(f"❌ Spring Boot 통지(MQ 발행) 실패: {e}")
            raise Exception(f"MQ 콜백 중 오류 발생: {str(e)}")