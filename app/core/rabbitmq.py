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

    async def consume(self, callback_func):
        """메시지를 큐에서 수신합니다. Subscribe"""
        if not self.channel:
            await self.connect()
        
        try:
            queue = await self.channel.get_queue(settings.RABBITMQ_QUEUE_NAME)
            await queue.consume(callback_func)
        
            logger.info("✅ RabbitMQ Consumer 구동 완료")
        except Exception as e:
            logger.error(f"❌ RabbitMQ Consumer 구동 실패: {e}")
            raise

    async def send_message(self, message: dict, queue_name: str = None):
        """메시지를 지정된 큐에 전송합니다."""
        if not self.channel:
            await self.connect()
        
        # queue_name이 명시되지 않으면 기존처럼 기본 설정된 큐 사용(하위 호환성 유지)
        target_queue = queue_name or settings.RABBITMQ_QUEUE_NAME

        try:
            # queue가 존재하지 않는 경우 queue를 만들어줌
            await self.channel.declare_queue(target_queue, durable=True)

            await self.channel.default_exchange.publish(
                aio_pika.Message(
                    # ensure_ascii=False 추가: JSON 변환 시 한글 데이터 깨짐 방지
                    body=json.dumps(message, ensure_ascii=False).encode("utf-8"),
                    delivery_mode=aio_pika.DeliveryMode.PERSISTENT   # 메시지 영속성 추가 (durable=True 큐와 함께 사용)
                ),
                routing_key=target_queue    # 동적으로 목적지 큐 할당
            )
            logger.info(f"📤 '{target_queue}' 큐로 메시지 전송 성공: {message}")
        except Exception as e:
            logger.error(f"❌ '{target_queue}' 큐로 메시지 전송 실패: {e}")
            raise


# 전역에서 재사용할 싱글톤 인스턴스
rabbitmq_client = RabbitMQClient()