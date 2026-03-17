import asyncio
import numpy as np
import torch
from typing import Dict


class VoiceSeparator:
    """
    Demucs htdemucs 2-stem 모드를 사용하여 오디오를 분리하는 공통 모듈입니다.
    감정 분석, 배경음 식별 등 여러 AI 태스크에서 공통으로 사용합니다.

    반환:
        {
            "vocals":    np.ndarray  # 목소리만 → 감정 분석 AI 입력
            "no_vocals": np.ndarray  # 배경음 전체 → 배경음 식별 AI 입력
        }
    """

    SAMPLE_RATE: int = 44100  # Demucs 권장 샘플링 레이트 (내부 처리 후 16000Hz로 다운샘플)
    MODEL_NAME: str = "htdemucs"

    def __init__(self):
        # Demucs 모델은 최초 호출 시 lazy loading (무거운 모델, 메모리 주의)
        self._model = None

    def _load_model(self):
        """Demucs 모델을 최초 1회만 로드합니다."""
        if self._model is None:
            from demucs.pretrained import get_model
            print(f"[VoiceSeparator] Demucs '{self.MODEL_NAME}' 모델 로딩 중...")
            self._model = get_model(self.MODEL_NAME)
            self._model.eval()
            print("[VoiceSeparator] 모델 로드 완료.")
        return self._model

    async def separate(self, audio_array: np.ndarray, sr: int = 16000) -> Dict[str, np.ndarray]:
        """
        입력 오디오 배열을 목소리(vocals)와 배경음(no_vocals)으로 분리합니다.

        Args:
            audio_array: AudioService에서 추출된 float32 NumPy 배열 (16000Hz 모노)
            sr:          입력 배열의 샘플링 레이트 (기본 16000Hz)

        Returns:
            {"vocals": np.ndarray, "no_vocals": np.ndarray}
            모두 입력과 동일한 샘플링 레이트(16000Hz) / 모노 배열로 반환됩니다.
        """
        print(f"[VoiceSeparator] 음성 분리 시작 (길이: {len(audio_array) / sr:.1f}초)")
        result = await asyncio.to_thread(self._sync_separate, audio_array, sr)
        print("[VoiceSeparator] 음성 분리 완료.")
        return result

    def _sync_separate(self, audio_array: np.ndarray, sr: int) -> Dict[str, np.ndarray]:
        """
        [동기/Blocking]
        Demucs로 실제 음원 분리를 수행합니다. to_thread를 통해 호출됩니다.
        """
        import torchaudio
        from demucs.apply import apply_model

        model = self._load_model()

        # 1. 16000Hz 모노 → Demucs 요구 포맷(44100Hz 스테레오)으로 업샘플링
        wav = torch.from_numpy(audio_array).float().unsqueeze(0)  # (1, samples)
        wav_stereo = wav.repeat(2, 1).unsqueeze(0)                 # (1, 2, samples)
        wav_resampled = torchaudio.functional.resample(wav_stereo, sr, self.SAMPLE_RATE)

        # 2. Demucs 2-stem 분리 실행 (vocals / no_vocals)
        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        model = model.to(device)
        wav_resampled = wav_resampled.to(device)

        with torch.no_grad():
            sources = apply_model(model, wav_resampled, device=device, progress=False)
        # sources shape: (batch, stems, channels, samples)
        # htdemucs stem 순서: drums, bass, other, vocals

        stem_names = model.sources  # 예: ["drums", "bass", "other", "vocals"]

        # 3. vocals / no_vocals 분리
        vocal_idx = stem_names.index("vocals")
        # 나머지 스템을 모두 합산해 no_vocals 구성
        no_vocal_stems = [
            sources[0, i]
            for i in range(len(stem_names))
            if i != vocal_idx
        ]

        vocals_tensor = sources[0, vocal_idx]                       # (2, samples) 스테레오
        no_vocals_tensor = torch.stack(no_vocal_stems, dim=0).sum(dim=0)  # 합산 → (2, samples)

        # 4. 스테레오 → 모노, Demucs 샘플레이트 → 입력 샘플레이트(16000Hz)로 다운샘플링
        def to_mono_array(tensor: torch.Tensor) -> np.ndarray:
            mono = tensor.mean(dim=0, keepdim=True).unsqueeze(0)    # (1, 1, samples)
            down = torchaudio.functional.resample(mono.cpu(), self.SAMPLE_RATE, sr)
            return down.squeeze().numpy().astype(np.float32)

        return {
            "vocals": to_mono_array(vocals_tensor),
            "no_vocals": to_mono_array(no_vocals_tensor),
        }
