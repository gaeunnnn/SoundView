import json
import logging
from typing import Optional

import aio_pika
from aio_pika.abc import AbstractConnection, AbstractChannel, AbstractQueue
from app.core.config import settings

# 로깅 설정
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class RabbitMQClient:
    def __init__(self):
        # Python 3.9 호환을 위해 typing.Optional 사용
        self.connection: Optional[AbstractConnection] = None
        self.channel: Optional[AbstractChannel] = None
        self.queue: Optional[AbstractQueue] = None

    async def connect(self):
        """RabbitMQ 서버에 연결하고 채널을 설정합니다."""
        try:
            self.connection = await aio_pika.connect_robust(settings.rabbitmq_url)
            self.channel = await self.connection.channel()
            self.queue = await self.channel.declare_queue(settings.RABBITMQ_QUEUE_NAME, durable=True)
            logger.info("✅ RabbitMQ 연결 성공 및 큐 선언 완료")
        except Exception as e:
            logger.error(f"❌ RabbitMQ 연결 실패: {e}")
            raise

    async def close(self):
        """연결을 종료합니다."""
        if self.connection and not self.connection.is_closed:
            await self.connection.close()
            logger.info("🔌 RabbitMQ 연결 종료")

    async def send_message(self, message: dict):
        """메시지를 큐에 전송합니다."""
        if not self.channel:
            await self.connect()
        
        try:
            await self.channel.default_exchange.publish(
                aio_pika.Message(
                    body=json.dumps(message).encode("utf-8"),
                    delivery_mode=aio_pika.DeliveryMode.PERSISTENT # 메시지 영속성 추가 (durable=True 큐와 함께 사용)
                ),
                routing_key=settings.RABBITMQ_QUEUE_NAME
            )
            logger.info(f"📤 메시지 전송 성공: {message}")
        except Exception as e:
            logger.error(f"❌ 메시지 전송 실패: {e}")
            raise

# 전역에서 재사용할 싱글톤 인스턴스
rabbitmq_client = RabbitMQClient()