import asyncio
import subprocess
import numpy as np
from pathlib import Path
import logging

logger = logging.getLogger(__name__)


class AudioService:
    """
    영상 파일에서 음성을 추출하는 서비스 클래스입니다.
    모든 작업 task에서 공통으로 사용하는 인프라 레이어입니다.

    ffmpeg 파이프를 사용하여 중간 파일 없이 메모리 배열(NumPy)로 직접 반환합니다.
    """

    SAMPLE_RATE: int = 16000  # AI 모델(WavLM, Whisper) 필요 샘플링 레이트

    async def extract_audio(self, video_path: str) -> np.ndarray:
        """
        영상 파일에서 음성을 비동기적으로 추출하여 NumPy float32 배열로 반환합니다.

        Args:
            video_path: 다운로드된 영상 임시 파일 경로 (.mp4, .avi 등)

        Returns:
            np.ndarray: 16000Hz 모노 float32 오디오 배열

        Raises:
            RuntimeError: ffmpeg 실행 실패 또는 오디오 추출 실패 시
        """
        if not Path(video_path).exists():
            raise FileNotFoundError(f"영상 파일을 찾을 수 없습니다: {video_path}")

        logger.info(f"[AudioService] 영상에서 음성 추출 시작: {video_path}")

        # ffmpeg 파이프 실행을 별도 스레드에서 처리 (이벤트 루프 블로킹 방지)
        audio_array = await asyncio.to_thread(self._extract_with_ffmpeg, video_path)

        logger.info(f"[AudioService] 음성 추출 완료: {len(audio_array) / self.SAMPLE_RATE:.1f}초")
        return audio_array

    def _extract_with_ffmpeg(self, video_path: str) -> np.ndarray:
        """
        [동기/Blocking]
        ffmpeg subprocess를 직접 실행하여 오디오를 stdout 파이프로 받아
        NumPy 배열로 변환합니다. 중간 파일이 전혀 생성되지 않습니다.
        """
        cmd = [
            "ffmpeg",
            "-i", video_path,         # 입력 영상 파일
            "-vn",                     # 비디오 스트림 제거 (오디오만 추출)
            "-acodec", "pcm_s16le",   # 오디오 코덱: 16bit PCM (범용 포맷)
            "-ar", str(self.SAMPLE_RATE),  # 샘플링 레이트 16000Hz
            "-ac", "1",               # 모노 채널
            "-f", "s16le",            # stdout으로 출력할 raw PCM 포맷
            "-loglevel", "error",     # ffmpeg stderr 로그 최소화
            "pipe:1",                 # stdout으로 출력
        ]

        try:
            result = subprocess.run(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
            )
        except FileNotFoundError:
            raise RuntimeError(
                "ffmpeg이 설치되어 있지 않습니다. "
                "Linux: 'apt-get install -y ffmpeg' / "
                "Windows: 'winget install ffmpeg'"
            )

        # ffmpeg 실행 실패 처리
        if result.returncode != 0:
            error_msg = result.stderr.decode("utf-8", errors="ignore")
            raise RuntimeError(f"ffmpeg 오디오 추출 실패 (exit code {result.returncode}): {error_msg}")

        if not result.stdout:
            raise RuntimeError("ffmpeg가 오디오 데이터를 생성하지 못했습니다. 영상에 오디오 트랙이 없을 수 있습니다.")

        # int16 raw PCM 바이트 → float32 NumPy 배열 변환 (-1.0 ~ 1.0 정규화)
        audio_array = np.frombuffer(result.stdout, dtype=np.int16).astype(np.float32) / 32768.0
        return audio_array
