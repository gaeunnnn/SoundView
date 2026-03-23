import asyncio
import struct
import numpy as np
from typing import Any, Dict, List
import librosa
from scipy.signal import butter, sosfilt
from scipy.ndimage import uniform_filter1d

from app.services.ai.base import BaseAIModel


# ═══════════════════════════════════════════════════════════════════════
# v12 커스텀 RTP 엔벨로프 (모터 물리 + 브레이킹 반영)
# ═══════════════════════════════════════════════════════════════════════
def _make_sharp_env(peak, max_len):
    t = np.array([1.0, 1.0, 1.0, 0, 0, 0, 0, 0])
    return t[:min(len(t), max_len)] * peak

def _make_bounce_env(peak, max_len):
    t = np.array([1.0, 1.0, 0, 0, 0.35, 0.35, 0, 0, 0, 0])
    return t[:min(len(t), max_len)] * peak

def _make_punch_env(peak, max_len):
    t = np.array([0.7, 0.9, 1.0, 0.8, 0.5, 0.25, 0.1, 0, 0, 0])
    return t[:min(len(t), max_len)] * peak

def _make_smooth_env(peak, max_len):
    t = np.array([0.2, 0.5, 0.8, 1.0, 0.9, 0.7, 0.5, 0.3, 0.15, 0.05, 0, 0])
    return t[:min(len(t), max_len)] * peak

def _make_medium_env(peak, max_len):
    t = np.array([0.5, 0.9, 1.0, 0.8, 0.5, 0.3, 0.1, 0, 0, 0])
    return t[:min(len(t), max_len)] * peak

ENV_MAP = {
    'drums': _make_sharp_env,
    'bass': _make_punch_env,
    'vocals': _make_smooth_env,
    'other': _make_medium_env,
}

STEM_CONFIG = {
    'drums':  {'peak_min': 160, 'peak_max': 255, 'threshold': 0.08},
    'bass':   {'peak_min': 100, 'peak_max': 200, 'threshold': 0.10},
    'vocals': {'peak_min':  80, 'peak_max': 200, 'threshold': 0.08},
    'other':  {'peak_min':  60, 'peak_max': 160, 'threshold': 0.10},
}


def _apply_env(output, start, env):
    for i in range(len(env)):
        idx = start + i
        if idx < len(output):
            output[idx] = max(output[idx], env[i])



# ═══════════════════════════════════════════════════════════════════════
# 스템별 이벤트 추출 (v12)
# ═══════════════════════════════════════════════════════════════════════
def _process_stem(y_stem, y_full, sr, fps, stem_type, gain=1.0):
    hop = int(sr / fps)
    rms = librosa.feature.rms(y=y_stem, hop_length=hop)[0]
    rms_full = librosa.feature.rms(y=y_full, hop_length=hop)[0]
    n = min(len(rms), len(rms_full))
    rms, rms_full = rms[:n], rms_full[:n]

    r_max = np.max(rms) if np.max(rms) > 0 else 1
    silence_thresh = np.max(rms_full) * 0.015
    output = np.zeros(n, dtype=np.float64)

    onsets = librosa.onset.onset_detect(
        y=y_stem, sr=sr, hop_length=hop, backtrack=False)
    onsets = onsets[onsets < n]
    onset_str = librosa.onset.onset_strength(y=y_stem, sr=sr, hop_length=hop)[:n]
    oe_max = np.percentile(onset_str[onset_str > 0], 90) if np.any(onset_str > 0) else 1

    beat_set = set()
    if stem_type == 'drums':
        tempo, bf = librosa.beat.beat_track(y=y_stem, sr=sr, hop_length=hop)
        beat_set = set(bf[bf < n].tolist())

    cfg = STEM_CONFIG.get(stem_type, STEM_CONFIG['other'])
    env_fn = ENV_MAP.get(stem_type, _make_medium_env)

    for oi in onsets:
        strength = min(onset_str[oi] / oe_max * 1.3, 1.0)
        if strength < cfg['threshold']:
            continue
        peak = (cfg['peak_min'] + strength * (cfg['peak_max'] - cfg['peak_min'])) * gain

        if stem_type == 'drums':
            if any(abs(oi - b) <= 2 for b in beat_set):
                env = _make_bounce_env(peak, n - oi)
            else:
                env = _make_sharp_env(peak, n - oi)
        else:
            env = env_fn(peak, n - oi)

        _apply_env(output, oi, env)

    output[rms_full < silence_thresh] = 0
    output[output < 12] = 0
    return np.clip(output, 0, 255).astype(np.uint8)


# ═══════════════════════════════════════════════════════════════════════
# VibrationModel
# ═══════════════════════════════════════════════════════════════════════
class VibrationModel(BaseAIModel[Dict[str, np.ndarray], Dict[str, Any]]):
    """
    오디오 트랙 딕셔너리 → L/R 진동 데이터 (JSON + BIN)

    v12: Demucs 4-stem + 커스텀 RTP 엔벨로프 (이벤트 기반)
      L = drums + bass
      R = vocals + other

    입력: Dict[str, np.ndarray] (VoiceSeparator의 분리 결과, 16000Hz mono)
    출력: {
        "duration": float,
        "start": float,
        ...
        "frames": [...],
        "bin": bytes
    }
    """

    def __init__(self, l_gain: float = 1.0, r_gain: float = 1.0, fps: int = 50):
        self.l_gain = l_gain
        self.r_gain = r_gain
        self.fps = fps

    async def predict(self, tracks: Dict[str, np.ndarray]) -> Dict[str, Any]:
        print("[VibrationModel] 진동 데이터 분석 중...")
        loop = asyncio.get_running_loop()
        try:
            results = await loop.run_in_executor(None, self._analyze_vibration, tracks)
            return results
        except Exception as e:
            print(f"[ERR] VibrationModel: {e}")
            raise e

    def _analyze_vibration(self, stems: Dict[str, np.ndarray]) -> Dict[str, Any]:
        sr = 16000
        fps = self.fps

        # 원본 길이 계산용 (기본 트랙으로 vocals와 no_vocals의 합산을 원본으로 간주)
        y_vocals = stems.get('vocals', np.array([]))
        y_no_vocals = stems.get('no_vocals', np.array([]))
        
        if len(y_vocals) > 0 and len(y_no_vocals) > 0:
            y_full = y_vocals + y_no_vocals
        else:
            y_full = y_vocals if len(y_vocals) > 0 else list(stems.values())[0]

        hop = int(sr / fps)
        n = len(librosa.feature.rms(y=y_full, hop_length=hop)[0])

        gain_map = {
            'drums': self.l_gain, 'bass': self.l_gain,
            'vocals': self.r_gain, 'other': self.r_gain,
        }

        stem_results = {}
        for stem_name in ['drums', 'bass', 'vocals', 'other']:
            if stem_name in stems:
                y_stem = stems[stem_name]
                min_len = min(len(y_stem), len(y_full))
                arr = _process_stem(
                    y_stem[:min_len], y_full[:min_len],
                    sr, fps, stem_name, gain=gain_map[stem_name])
                stem_results[stem_name] = arr[:n]

        # ── L = drums + bass, R = vocals + other ─────────────────────
        int_l = np.zeros(n, dtype=np.uint8)
        for stem in ['drums', 'bass']:
            if stem in stem_results:
                int_l = np.maximum(int_l, stem_results[stem][:n])

        int_r = np.zeros(n, dtype=np.uint8)
        for stem in ['vocals', 'other']:
            if stem in stem_results:
                int_r = np.maximum(int_r, stem_results[stem][:n])

        # ── JSON 프레임 데이터 ────────────────────────────────────────
        duration = round(n / fps, 3)

        frames = []
        for i in range(n):
            frames.append({
                "timeline": round(i / fps, 3),
                "frame": i,
                "dBL": int(int_l[i]),
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
            "start": 0.0,
            "end": duration,
            "fps": fps,
            "total_frames": n,
            "frames": frames,
            "bin": bin_data,
        }