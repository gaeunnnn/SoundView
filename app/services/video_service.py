import asyncio
import numpy as np
from typing import Any, Dict, Optional
from app.services.storage_service import StorageService
from app.services.audio_service import AudioService
from app.services.callback_service import CallbackService
from app.services.ai.common.voice_separator import VoiceSeparator
from app.services.ai.tasks.WavLM_KLUEBERT_Whisper.model_handler import SubtitleModel, VibrationModel
from app.services.ai.tasks.atst.sound_event_model import SoundEventModel


class VideoService:
    """
    영상 처리 파이프라인 전체 흐름을 오케스트레이션하는 서비스 클래스입니다.
    AI 모델, 스토리지, 콜백을 조율하며 비즈니스 로직의 진입점 역할을 합니다.
    """

    def __init__(self) -> None:
        self.storage = StorageService()
        self.audio = AudioService()
        self.voice_sep = VoiceSeparator()         # 공통 음성 분리 (Demucs)
        print("[VideoService] AI 자막, 진동, 효과음 모델을 백그라운드로 로딩 시작합니다...")
        self.subtitle_model = SubtitleModel()
        self.vibration_model = VibrationModel()
        self.sound_event_model = SoundEventModel()
        self.callback = CallbackService()

    async def process_video(self, video_id: str, video_url: str) -> Dict[str, Any]:
        """
        1. 영상 다운로드 (StorageService)
        2. AI 추론       (SubtitleModel + VibrationModel 병렬 실행)
        3. 결과 업로드   (StorageService)
        4. 완료 콜백(RabbitMQ 사용)     (CallbackService)
        5. 임시 파일 정리
        
        두 AI 모델 중 하나라도 실패하면 전체가 실패합니다.
        """
        temp_path: Optional[str] = None
        try:
            # 1. 전처리 — MinIO에서 영상 다운로드
            temp_path = await self.storage.download_video(video_url)

            # 2. 전처리 — 영상에서 음성 추출 (ffmpeg 파이프, 중간 파일 없음)
            audio_array = await self.audio.extract_audio(temp_path)

            # 3. 전처리 — 목소리(vocals) / 배경음(no_vocals) 분리 (Demucs 2-stem)
            #    각 AI 모델은 해당 트랙만 수신하여 정확도가 높아집니다.
            tracks = await self.voice_sep.separate(audio_array)

            # 4. AI 추론 — 세 모델을 병렬 실행 (하나라도 실패 시 전체 예외 발생)
            #    SubtitleModel : 원본 오디오 사용 (배경음 포함 원본, AI 자체 노이즈 캔슬링/VAD 최적화)
            #    VibrationModel: 오디오의 목적에 맞는 트랙만 사용 (예: vocals)
            #    SoundEventModel: 배경음 전용 분류 분석 (no_vocals)
            subtitle_result, vibration_result, sound_event_result = await asyncio.gather(
                self.subtitle_model.predict(audio_array),
                self.vibration_model.predict(tracks["no_vocals"]),
                self.sound_event_model.predict(tracks["no_vocals"])
            )

            # 4. 후처리 — S3에 결과 업로드 (분리 업로드)
            subtitle_url, vibration_url, sound_event_url = await self.storage.upload_results(
                video_id, subtitle_result, vibration_result, sound_event_result
            )

            # 5. Spring Boot 완료 콜백
            await self.callback.notify_complete(video_id, subtitle_url, vibration_url, sound_event_url)

            return {
                "video_id": video_id,
                "subtitle_url": subtitle_url,
                "vibration_url": vibration_url,
                "sound_event_url": sound_event_url,
                "status": "success"
            }
        finally:
            # 임시 파일 정리 (성공·실패 무관하게 항상 실행)
            if temp_path:
                self.storage.cleanup(temp_path)
