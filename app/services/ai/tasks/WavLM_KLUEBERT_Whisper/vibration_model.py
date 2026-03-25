import asyncio
import struct
import numpy as np
from typing import Any, Dict, List
import librosa
from scipy.signal import butter, sosfilt
from scipy.ndimage import uniform_filter1d

from app.services.ai.base import BaseAIModel


# ═══════════════════════════════════════════════════════════════════════
# 환경음 전용 RTP 엔벨로프 (모터 물리 + 브레이킹 반영)
# ═══════════════════════════════════════════════════════════════════════
def _make_impact_env(peak, decay_frames):
    """충격음 (문닫힘, 유리깨짐, 박수): 즉시 피크 → 하드 컷(브레이킹)"""
    n = 4 + decay_frames
    env = np.zeros(n)
    env[0] = peak * 0.6
    env[1:4] = peak
    # 나머지는 0 → 브레이킹
    return env

def _make_rumble_env(peak, decay_frames):
    """지속 저음 (엔진, 천둥, 진동): 가우시안 벨 커브"""
    n = 3 + decay_frames
    t = np.arange(n)
    sigma = n / 4.0
    env = peak * np.exp(-0.5 * ((t - 2.5) / sigma) ** 2)
    env[env < peak * 0.03] = 0
    return env

def _make_alert_env(peak, decay_frames):
    """고음 알림 (경적, 벨, 알람): 빠른 사인 어택 → 서스테인 → 디케이"""
    n = 4 + decay_frames
    env = np.zeros(n)
    # 빠른 cosine 어택
    atk = min(3, n)
    env[:atk] = peak * 0.5 * (1 - np.cos(np.pi * np.arange(atk) / atk))
    # 짧은 서스테인
    sus_end = min(atk + 2, n)
    env[atk:sus_end] = peak
    # cosine 디케이
    dec_len = n - sus_end
    if dec_len > 0:
        env[sus_end:] = peak * 0.5 * (1 + np.cos(np.pi * np.arange(dec_len) / dec_len))
    env[env < peak * 0.03] = 0
    return env

def _make_gentle_env(peak, decay_frames):
    """부드러운 고음 (새소리, 물소리): 반파 사인"""
    n = 4 + decay_frames
    env = peak * np.sin(np.linspace(0, np.pi, n))
    env[env < peak * 0.03] = 0
    return env


def _apply_env(output, start, env):
    end = min(start + len(env), len(output))
    for i in range(end - start):
        output[start + i] = max(output[start + i], env[i])


# ═══════════════════════════════════════════════════════════════════════
# 글로벌 음원 분석 → 자동 파라미터
# ═══════════════════════════════════════════════════════════════════════
def _analyze_profile(y: np.ndarray, sr: int, fps: int) -> dict:
    """전체 환경음 분석 → 변환 파라미터 결정용 프로필"""
    hop = int(sr / fps)
    rms = librosa.feature.rms(y=y, hop_length=hop)[0]
    db = librosa.amplitude_to_db(rms, ref=1.0)
    duration = len(y) / sr

    # 다이나믹 레인지
    iqr = float(np.percentile(db, 75) - np.percentile(db, 25))

    # 크레스트 팩터
    rms_total = float(np.sqrt(np.mean(y ** 2)))
    crest_db = float(20 * np.log10(np.max(np.abs(y)) / (rms_total + 1e-10)))

    # 온셋 밀도
    onsets = librosa.onset.onset_detect(y=y, sr=sr, hop_length=hop)
    onset_density = len(onsets) / max(duration, 0.1)

    # 저음/고음 에너지 비율
    sos_lo = butter(4, 300, btype='low', fs=sr, output='sos')
    sos_hi = butter(4, 300, btype='high', fs=sr, output='sos')
    e_lo = float(librosa.feature.rms(y=sosfilt(sos_lo, y), hop_length=hop)[0].mean())
    e_hi = float(librosa.feature.rms(y=sosfilt(sos_hi, y), hop_length=hop)[0].mean())
    lo_ratio = e_lo / (e_lo + e_hi + 1e-10)

    # 무음 비율 (환경음은 무음이 많을 수 있음)
    silence_thresh = np.max(rms) * 0.02
    silence_ratio = float(np.mean(rms < silence_thresh))

    # 실제 콘텐츠 시작/끝
    nonsilent = np.where(rms > silence_thresh)[0]
    if len(nonsilent) > 0:
        content_start = round(float(nonsilent[0]) / fps, 3)
        content_end = round(float(nonsilent[-1] + 1) / fps, 3)
    else:
        content_start = 0.0
        content_end = round(duration, 3)

    return {
        'iqr': iqr,
        'crest_db': crest_db,
        'onset_density': onset_density,
        'lo_ratio': lo_ratio,
        'silence_ratio': silence_ratio,
        'content_start': content_start,
        'content_end': content_end,
    }


def _auto_params(profile: dict) -> dict:
    """환경음 프로필 → 변환 파라미터 자동 결정"""
    iqr = profile['iqr']
    onset_d = profile['onset_density']
    lo_ratio = profile['lo_ratio']
    crest = profile['crest_db']
    silence = profile['silence_ratio']

    # ── decay 길이: 환경음은 음악보다 이벤트 간격이 넓으므로 기본 길게
    if iqr < 5:
        decay_frames = 5
    elif iqr < 15:
        decay_frames = 7
    else:
        decay_frames = 10    # 넓은 다이나믹 → 긴 꼬리

    # ── onset threshold: 무음 많으면 민감하게 (작은 소리도 중요)
    if silence > 0.5:
        onset_thresh = 0.05  # 무음 많은 환경 → 소리나면 다 잡기
    elif onset_d > 4:
        onset_thresh = 0.12  # 이벤트 빽빽 → 선별
    else:
        onset_thresh = 0.08

    # ── L/R gain 자동 밸런스
    l_gain = 0.7 + lo_ratio * 0.6
    r_gain = 0.7 + (1 - lo_ratio) * 0.6

    # ── peak scaling
    if crest < 10:
        peak_scale = 1.3
    elif crest < 20:
        peak_scale = 1.0
    else:
        peak_scale = 0.85    # 환경음은 순간 피크가 클 수 있음

    # ── 강한 온셋 임계 (충격음 vs 지속음 분류용)
    #    onset_strength > strong_thresh 이면 충격음 엔벨로프
    strong_thresh = 0.6 if onset_d < 2 else 0.75

    return {
        'decay_frames': decay_frames,
        'onset_thresh': onset_thresh,
        'l_gain': round(l_gain, 2),
        'r_gain': round(r_gain, 2),
        'peak_scale': peak_scale,
        'strong_thresh': strong_thresh,
    }


# ═══════════════════════════════════════════════════════════════════════
# 밴드별 이벤트 추출 (환경음 전용)
# ═══════════════════════════════════════════════════════════════════════
def _process_band(y_band: np.ndarray, y_full: np.ndarray,
                  sr: int, fps: int, is_low: bool,
                  gain: float, decay_frames: int, onset_thresh: float,
                  peak_scale: float, strong_thresh: float) -> np.ndarray:
    hop = int(sr / fps)
    rms = librosa.feature.rms(y=y_band, hop_length=hop)[0]
    rms_full = librosa.feature.rms(y=y_full, hop_length=hop)[0]
    n = min(len(rms), len(rms_full))
    rms, rms_full = rms[:n], rms_full[:n]

    r_max = np.max(rms) if np.max(rms) > 0 else 1
    silence_thresh = np.max(rms_full) * 0.015
    output = np.zeros(n, dtype=np.float64)

    onsets = librosa.onset.onset_detect(
        y=y_band, sr=sr, hop_length=hop, backtrack=False)
    onsets = onsets[onsets < n]
    onset_str = librosa.onset.onset_strength(y=y_band, sr=sr, hop_length=hop)[:n]
    oe_max = np.percentile(onset_str[onset_str > 0], 90) if np.any(onset_str > 0) else 1

    if is_low:
        # ── 저음: 충격음(문닫힘) vs 지속음(엔진) 자동 분류
        PEAK_MIN, PEAK_MAX = 140, 255

        for oi in onsets:
            strength = min(onset_str[oi] / oe_max * 1.3, 1.0)
            if strength < onset_thresh:
                continue

            peak = min((PEAK_MIN + strength * (PEAK_MAX - PEAK_MIN))
                       * gain * peak_scale, 255)

            # onset strength로 충격/지속 분류
            if strength >= strong_thresh:
                # 강한 온셋 → 충격음 (문닫힘, 쾅)
                env = _make_impact_env(peak, decay_frames)
            else:
                # 약한 온셋 → 지속 저음 (엔진, 진동)
                env = _make_rumble_env(peak, decay_frames)

            _apply_env(output, oi, env)

    else:
        # ── 고음: 알림음(경적) vs 자연음(새소리) 자동 분류
        PEAK_MIN, PEAK_MAX = 80, 220

        for oi in onsets:
            strength = min(onset_str[oi] / oe_max * 1.3, 1.0)
            if strength < onset_thresh:
                continue

            peak = min((PEAK_MIN + strength * (PEAK_MAX - PEAK_MIN))
                       * gain * peak_scale, 255)

            if strength >= strong_thresh:
                # 강한 고음 온셋 → 알림/경적 (날카롭게)
                env = _make_alert_env(peak, decay_frames)
            else:
                # 부드러운 고음 → 자연음 (새, 물)
                env = _make_gentle_env(peak, decay_frames)

            _apply_env(output, oi, env)

    output[rms_full < silence_thresh] = 0
    output[output < 12] = 0
    return np.clip(output, 0, 255).astype(np.uint8)


# ═══════════════════════════════════════════════════════════════════════
# VibrationModel
# ═══════════════════════════════════════════════════════════════════════
class VibrationModel(BaseAIModel[np.ndarray, Dict[str, Any]]):
    """
    Demucs 분리된 환경음 → L/R 진동 데이터 (JSON + BIN)

    환경음 전용 최적화:
      - 비트 트래킹 없음 (음악이 아닌 일상 소리)
      - onset strength 기반 충격음/지속음 자동 분류
      - 저음: 충격음(문닫힘) → impact, 지속음(엔진) → rumble
      - 고음: 알림(경적) → alert, 자연음(새소리) → gentle
      - 글로벌 분석으로 파라미터 자동 튜닝

    입력: float32 오디오 배열 (16000Hz mono, Demucs 환경음)
    출력: {
        "duration": float,
        "start": float,
        "end": float,
        "fps": int,
        "total_frames": int,
        "profile": {...},
        "auto_params": {...},
        "frames": [{"timeline", "frame", "dBL", "dBR"}, ...],
        "bin": bytes
    }
    """

    def __init__(self, fps: int = 50, crossover: int = 300):
        self.fps = fps
        self.crossover = crossover

    async def predict(self, vocal_array: np.ndarray) -> Dict[str, Any]:
        print("[VibrationModel] 진동 데이터 분석 중...")
        loop = asyncio.get_running_loop()
        try:
            results = await loop.run_in_executor(None, self._analyze_vibration, vocal_array)
            return results
        except Exception as e:
            print(f"[ERR] VibrationModel: {e}")
            raise e

    def _analyze_vibration(self, vocal_array: np.ndarray) -> Dict[str, Any]:
        sr = 16000
        fps = self.fps

        if vocal_array.ndim > 1:
            vocal_array = librosa.to_mono(vocal_array)

        # ── 글로벌 분석 → 자동 파라미터 ──────────────────────────────
        profile = _analyze_profile(vocal_array, sr, fps)
        params = _auto_params(profile)

        # ── 주파수 2밴드 분리 ─────────────────────────────────────────
        sos_low = butter(4, self.crossover, btype='low', fs=sr, output='sos')
        y_low = sosfilt(sos_low, vocal_array)

        sos_high = butter(4, self.crossover, btype='high', fs=sr, output='sos')
        y_high = sosfilt(sos_high, vocal_array)

        # ── 밴드별 이벤트 추출 ────────────────────────────────────────
        int_l = _process_band(
            y_low, vocal_array, sr, fps, is_low=True,
            gain=params['l_gain'],
            decay_frames=params['decay_frames'],
            onset_thresh=params['onset_thresh'],
            peak_scale=params['peak_scale'],
            strong_thresh=params['strong_thresh'])

        int_r = _process_band(
            y_high, vocal_array, sr, fps, is_low=False,
            gain=params['r_gain'],
            decay_frames=params['decay_frames'],
            onset_thresh=params['onset_thresh'],
            peak_scale=params['peak_scale'],
            strong_thresh=params['strong_thresh'])

        n = min(len(int_l), len(int_r))
        int_l, int_r = int_l[:n], int_r[:n]

        # ── JSON 프레임 ───────────────────────────────────────────────
        duration = round(n / fps, 3)
        frames = []
        for i in range(n):
            frames.append({
                "timeline": round(i / fps, 3),
                "frame": i,
                "dBL": int(int_l[i]),+/
                "dBR": int(int_r[i]),
            })

        # ── VIB1 바이너리 ─────────────────────────────────────────────
        payload = np.empty(n * 2, dtype=np.uint8)
        payload[0::2] = int_l
        payload[1::2] = int_r
        header = struct.pack("<4sBHIB", b"VIB1", 1, fps, n, 2)
        bin_data = header + payload.tobytes()

        return {
            "duration": duration,
            "start": profile['content_start'],
            "end": profile['content_end'],
            "fps": fps,
            "total_frames": n,
            "profile": profile,
            "auto_params": params,
            "frames": frames,
            "bin": bin_data,
        }
