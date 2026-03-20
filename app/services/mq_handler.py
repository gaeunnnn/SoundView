import json
import logging
import aio_pika

from app.services.video_service import VideoService
from app.core.config import settings


logger = logging.getLogger(__name__)

# 전역 비디오 서비스 인스턴스, 서버가 켜질 때 모델이 1번 메모리에 로드
video_service = VideoService()

async def process_mq_message(message: aio_pika.Message):
    """RabbitMQ에서 수신한 메시지를 처리하는 콜백 함수."""
    async with message.process():
        try:
            body = message.body.decode("utf-8")
            data = json.loads(body)
            logger.info(f"수신된 메시지: {data}")
            
            # Spring Boot에서 넘어온 camelCase 키로 데이터 추출
            raw_video_id = data.get("videoId")
            video_key = data.get("videoKey")

            # id가 0일 수도 있으므로 None으로 체크
            if raw_video_id is not None and video_key:
                # baseurl + key를 활용해서 url 조합
                base_url = settings.S3_BASE_URL.rstrip('/')
                clean_key = video_key.lstrip('/')
                video_url = f"{base_url}/{clean_key}"

                video_id = str(raw_video_id)    # videoId 변환
                logger.info(f"VideoService 파이프라인 시작 (ID: {video_id})")

                # 비즈니스 로직 호출
                result = await video_service.process_video(video_id, video_url)
                logger.info(f"처리가 완료되었습니다: {result}")
            else:
                logger.warning("메시지에 videoId 또는 videoUrl이 없습니다.")
        except Exception as e:
            logger.error(f"메시지 처리 중 오류 발생: {e}")