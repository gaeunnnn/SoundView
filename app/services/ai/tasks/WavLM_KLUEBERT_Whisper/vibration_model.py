import asyncio
import numpy as np
from typing import Any, Dict, List
import librosa
from scipy.signal import butter, sosfilt
from scipy.ndimage import uniform_filter1d

from app.services.ai.base import BaseAIModel

def _make_envelope(peak: float, attack_f: int, sustain_f: int, decay_f: int, max_len: int) -> np.ndarray:
    total = min(attack_f + sustain_f + decay_f, max_len)
    env = np.zeros(total)
    atk = min(attack_f, total)
    if atk > 0:
        env[:atk] = np.linspace(peak * 0.3, peak, atk)
    sus_end = min(atk + sustain_f, total)
    env[atk:sus_end] = peak
    dec_start = sus_end
    dec_len = total - dec_start
    if dec_len > 0:
        env[dec_start:] = peak * np.exp(-np.arange(dec_len) * 3.0 / max(dec_len, 1))
    return env

def _process_band(y_band: np.ndarray, y_full: np.ndarray, sr: int, fps: int, band_name: str, is_low: bool) -> np.ndarray:
    """단일 주파수 밴드 → intensity (모터 물리 반영)"""
    hop = int(sr / fps)

    rms = librosa.feature.rms(y=y_band, hop_length=hop)[0]
    rms_full = librosa.feature.rms(y=y_full, hop_length=hop)[0]
    n = min(len(rms), len(rms_full))
    rms, rms_full = rms[:n], rms_full[:n]

    r_max = np.max(rms) if np.max(rms) > 0 else 1
    silence_thresh = np.max(rms_full) * 0.015

    output = np.zeros(n, dtype=np.float64)

    # ── 레이어 1: 기저 (밴드 에너지 추종)
    BASE_MIN, BASE_MAX = 10, 35
    base = np.power(rms / r_max, 0.5)
    base = uniform_filter1d(base, size=int(fps * 0.4))
    base = base * (BASE_MAX - BASE_MIN) + BASE_MIN
    base[rms_full < silence_thresh] = 0
    output = base.copy()

    # ── 레이어 2: 에너지 곡선 (크레센도/디크레센도)
    CRESC_MIN, CRESC_MAX = 40, 80
    energy = np.power(rms / r_max, 0.6)
    energy = uniform_filter1d(energy, size=int(fps * 0.3))
    cresc = energy * (CRESC_MAX - CRESC_MIN) + CRESC_MIN
    cresc[rms_full < silence_thresh] = 0
    output = np.maximum(output, cresc)

    # ── 레이어 3: 온셋 이벤트
    onsets = librosa.onset.onset_detect(
        y=y_band, sr=sr, hop_length=hop, backtrack=False
    )
    onsets = onsets[onsets < n]

    onset_env = librosa.onset.onset_strength(y=y_band, sr=sr, hop_length=hop)[:n]
    oe_max = np.percentile(onset_env[onset_env > 0], 90) if np.any(onset_env > 0) else 1

    if is_low:
        # 저음: 묵직한 펀치 — 긴 서스테인, 높은 피크
        EVENT_MIN, EVENT_MAX = 120, 255
        ATK_F, SUS_F, DEC_F = 1, 3, 6   # 20ms atk + 60ms sus + 120ms dec
    else:
        # 고음: 선명한 탭 — 짧은 서스테인
        EVENT_MIN, EVENT_MAX = 90, 200
        ATK_F, SUS_F, DEC_F = 2, 2, 5   # 40ms atk + 40ms sus + 100ms dec

    for oi in onsets:
        strength = min(onset_env[oi] / oe_max * 1.3, 1.0)
        if strength < 0.1:
            continue

        peak = EVENT_MIN + strength * (EVENT_MAX - EVENT_MIN)
        env = _make_envelope(peak, ATK_F, SUS_F, DEC_F, n - oi)

        for i in range(len(env)):
            if oi + i < n:
                output[oi + i] = max(output[oi + i], env[i])

    # ── 최종
    output[rms_full < silence_thresh] = 0
    return np.clip(output, 0, 255).astype(np.uint8)


class VibrationModel(BaseAIModel[np.ndarray, List[Dict[str, Any]]]):
    """
    목소리 트랙(vocal_array)을 입력받아 음성 진동(intensity) 데이터를 생성하는 AI 모델입니다.
    기존 주파수 밴드 L/R 분리 기반 스크립트를 적용하여 진동 패턴 json을 생성합니다.

    입력: VoiceSeparator.separate()의 'vocals' 또는 'no_vocals' 등 오디오 배열 (float32, 16000Hz, 모노)
    출력: [{"time": float, "intensity_l": int, "intensity_r": int}, ...]
    """

    async def predict(self, vocal_array: np.ndarray) -> List[Dict[str, Any]]:
        print("[VibrationModel] 진동 데이터 분석 중...")
        loop = asyncio.get_running_loop()
        # 블로킹 연산을 이그제큐터로 분리하여 비동기 실행
        try:
            results = await loop.run_in_executor(None, self._analyze_vibration, vocal_array)
            return results
        except Exception as e:
            print(f"[ERR] VibrationModel: {e}")
            raise e

    def _analyze_vibration(self, vocal_array: np.ndarray) -> List[Dict[str, Any]]:
        sr = 16000
        fps = 50
        crossover = 300

        # 모노가 아닌 경우 명시적으로 모노 변환
        if vocal_array.ndim > 1:
            vocal_array = librosa.to_mono(vocal_array)

        # ── 주파수 밴드 분리 (L = 저음, R = 고음)
        sos_low = butter(4, crossover, btype='low', fs=sr, output='sos')
        y_low = sosfilt(sos_low, vocal_array)

        sos_high = butter(4, crossover, btype='high', fs=sr, output='sos')
        y_high = sosfilt(sos_high, vocal_array)

        int_l = _process_band(y_low, vocal_array, sr, fps, "low", is_low=True)
        int_r = _process_band(y_high, vocal_array, sr, fps, "high", is_low=False)

        n = min(len(int_l), len(int_r))

        results = []
        for i in range(n):
            l_val = int(int_l[i])
            r_val = int(int_r[i])
            
            # 0이 아닌 이벤트만 저장하거나, 혹은 0.2초 단위 등 특정 프레임만 저장할 수 있으나
            # 모바일 등 클라이언트에서 부드러운 진동을 위해 intensity가 조금이라도 있으면 전달합니다.
            if l_val > 0 or r_val > 0:
                results.append({
                    "timestamp": round(i / fps, 3),
                    "intensity_l": l_val,
                    "intensity_r": r_val
                })

        return results
