import asyncio
from typing import Any, Dict, List
from app.services.ai.base import BaseAIModel


class SubtitleModel(BaseAIModel[str, List[Dict[str, Any]]]):
    """
    영상에서 감정이 담긴 자막 데이터를 생성하는 AI 모델 클래스입니다.
    """
    async def predict(self, video_path: str) -> List[Dict[str, Any]]:
        """
        영상을 분석하여 감정 자막 세그먼트 리스트를 반환합니다.
        """
        print(f"[SubtitleModel] Processing: {video_path}")
        await asyncio.sleep(1)  # 실제 AI 추론 시뮬레이션

        # 실제 연동 시 음성 인식 + 감정 분류 모델 결과를 반환
        return [
            {"start": 0.0, "end": 2.5, "text": "안녕하세요, 오늘 날씨가 정말 좋네요.", "emotion": "happy"},
            {"start": 3.0, "end": 5.5, "text": "함께 산책하러 가실래요?", "emotion": "neutral"},
        ]


class VibrationModel(BaseAIModel[str, List[Dict[str, Any]]]):
    """
    영상에서 음성 진동 데이터를 생성하는 AI 모델 클래스입니다.
    """
    async def predict(self, video_path: str) -> List[Dict[str, Any]]:
        """
        영상을 분석하여 타임스탬프별 진동 강도 데이터를 반환합니다.
        """
        print(f"[VibrationModel] Processing: {video_path}")
        await asyncio.sleep(1)  # 실제 AI 추론 시뮬레이션

        # 실제 연동 시 음성 에너지/주파수 분석 모델 결과를 반환
        return [
            {"timestamp": 0.5, "intensity": 0.8},
            {"timestamp": 3.2, "intensity": 0.6},
        ]
