"""
audio_to_esp32_v3.py
MP3/WAV → L/R 진동 패턴 변환 → ESP32 시리얼 전송 (v3 적응형)

v3 핵심: 음원 특성 자동 분석 → 파라미터 자동 결정
  - 다이나믹 레인지 → gamma 값
  - 온셋 밀도 → 어택 강도 / 디케이
  - 지속음 비율 → AM 변조 세기
  - 무음 비율 → 사일런스 임계값
"""

import argparse
import struct
import sys
import time
from pathlib import Path

import numpy as np

MAGIC           = b"VIB1"
CHANNELS        = 2
SUPPORTED_AUDIO = {".mp3", ".wav", ".flac", ".ogg", ".m4a"}


# ═══════════════════════════════════════════════════════════════════════
# 음원 특성 분석기
# ═══════════════════════════════════════════════════════════════════════
def analyze_audio(y: np.ndarray, sr: int, fps: int) -> dict:
    """음원의 핵심 특성을 분석하여 파라미터 결정에 사용할 지표 반환"""
    import librosa

    hop = int(sr / fps)
    rms = librosa.feature.rms(y=y, hop_length=hop)[0]
    db  = librosa.amplitude_to_db(rms, ref=1.0)

    # ── 1) 다이나믹 레인지 (Crest Factor + IQR) ──────────────────────
    # 크레스트 팩터: peak / rms 비율 (높으면 = 피크가 뾰족 = 넓은 다이나믹)
    peak = np.max(np.abs(y))
    rms_total = np.sqrt(np.mean(y**2))
    crest_factor = peak / (rms_total + 1e-10)
    crest_db = 20 * np.log10(crest_factor + 1e-10)

    # dB IQR: 중간 50% 값의 범위 (좁으면 = 압축된 음원)
    db_iqr = np.percentile(db, 75) - np.percentile(db, 25)

    # ── 2) 온셋 밀도 (초당 어택 수) ──────────────────────────────────
    onsets = librosa.onset.onset_detect(y=y, sr=sr, hop_length=hop)
    duration = len(y) / sr
    onset_density = len(onsets) / duration  # onsets/sec

    # ── 3) 지속음 비율 ───────────────────────────────────────────────
    # RMS가 중앙값의 70% 이상인 프레임이 연속 0.3초 이상 지속되는 비율
    from scipy.ndimage import uniform_filter1d
    rms_median = np.median(rms[rms > 0]) if np.any(rms > 0) else 0
    high_mask = rms > (rms_median * 0.7)
    smoothed = uniform_filter1d(high_mask.astype(float), size=max(1, int(fps * 0.3)))
    sustained_ratio = np.mean(smoothed > 0.7)

    # ── 4) 무음 비율 ────────────────────────────────────────────────
    silence_thresh_db = np.percentile(db, 10)
    silence_ratio = np.mean(db < silence_thresh_db + 3)

    # ── 5) 스펙트럴 특성 ────────────────────────────────────────────
    centroid = librosa.feature.spectral_centroid(y=y, sr=sr, hop_length=hop)[0]
    centroid_mean = np.mean(centroid)
    centroid_std  = np.std(centroid)

    profile = {
        "crest_db":        round(crest_db, 1),
        "db_iqr":          round(db_iqr, 1),
        "onset_density":   round(onset_density, 2),
        "sustained_ratio": round(sustained_ratio, 3),
        "silence_ratio":   round(silence_ratio, 3),
        "centroid_mean":   round(centroid_mean, 0),
        "centroid_std":    round(centroid_std, 0),
    }
    return profile


def auto_params(profile: dict) -> dict:
    """분석 결과 → 변환 파라미터 자동 결정"""

    crest   = profile["crest_db"]
    iqr     = profile["db_iqr"]
    onsets  = profile["onset_density"]
    sustain = profile["sustained_ratio"]
    silence = profile["silence_ratio"]

    # ── gamma: 다이나믹 레인지에 반비례 ──────────────────────────────
    # IQR 좁음(< 5dB) = 과압축 음원 → gamma 높게 (확장)
    # IQR 넓음(> 15dB) = 자연스러운 음원 → gamma 낮게 (보존)
    if iqr < 4:
        gamma = 2.5     # 극도로 압축된 음원 (팡파레, EDM)
    elif iqr < 8:
        gamma = 1.8     # 보통 상업 음악
    elif iqr < 15:
        gamma = 1.2     # 음성, 팟캐스트
    else:
        gamma = 0.8     # 클래식, 자연음 (오히려 살짝 압축)

    # ── 온셋 부스트: 밀도에 비례 ─────────────────────────────────────
    if onsets > 4:
        onset_boost = 0.15   # 매우 타악적 → 부스트 줄임 (이미 충분)
        onset_decay = 0.8    # 빠른 디케이
    elif onsets > 2:
        onset_boost = 0.25   # 보통
        onset_decay = 0.6
    else:
        onset_boost = 0.35   # 지속음 위주 → 가끔 오는 온셋 강조
        onset_decay = 0.4    # 느린 디케이

    # ── AM 변조: 지속음 비율에 비례 ──────────────────────────────────
    if sustain > 0.6:
        am_depth = 0.15      # 지속음 많음 → 강한 변조
        am_freq1, am_freq2 = 8, 13
    elif sustain > 0.3:
        am_depth = 0.10
        am_freq1, am_freq2 = 7, 11
    else:
        am_depth = 0.05      # 변화 많은 음원 → 약한 변조
        am_freq1, am_freq2 = 6, 10

    # ── 플럭스 기여도: 지속음일수록 중요 ─────────────────────────────
    flux_weight = 0.10 + sustain * 0.15  # 0.10 ~ 0.25

    # ── 사일런스 임계: 무음 비율에 맞게 ──────────────────────────────
    if silence > 0.3:
        silence_pct = 0.05   # 무음 많은 음원 → 넉넉한 임계
    else:
        silence_pct = 0.02   # 쉴 틈 없는 음원 → 타이트한 임계

    # ── 최소 진동값: 다이나믹 레인지에 따라 ──────────────────────────
    if iqr > 15:
        min_intensity = 10   # 넓은 레인지 → 낮은 값도 허용
    else:
        min_intensity = 20   # 좁은 레인지 → 최소값 높여서 체감 보장

    params = {
        "gamma":         gamma,
        "onset_boost":   onset_boost,
        "onset_decay":   onset_decay,
        "am_depth":      am_depth,
        "am_freq1":      am_freq1,
        "am_freq2":      am_freq2,
        "flux_weight":   flux_weight,
        "silence_pct":   silence_pct,
        "min_intensity": min_intensity,
    }
    return params


# ═══════════════════════════════════════════════════════════════════════
# 적응형 채널 프로세서
# ═══════════════════════════════════════════════════════════════════════
def _process_channel(y: np.ndarray, sr: int, fps: int, params: dict) -> np.ndarray:
    from scipy.ndimage import uniform_filter1d
    import librosa

    hop = int(sr / fps)

    # ── 1) Linear RMS 정규화 ─────────────────────────────────────────
    rms = librosa.feature.rms(y=y, hop_length=hop)[0]
    rms_max = np.max(rms)
    if rms_max < 1e-10:
        return np.zeros(len(rms), dtype=np.uint8)
    norm = rms / rms_max

    # ── 2) Gamma 커브 ────────────────────────────────────────────────
    shaped = np.power(norm, params["gamma"])

    # ── 3) 스펙트럴 플럭스 텍스처 ────────────────────────────────────
    S = np.abs(librosa.stft(y, hop_length=hop, n_fft=2048))
    flux = np.sqrt(np.sum(np.diff(S, axis=1)**2, axis=0))
    flux = np.pad(flux, (1, 0))[:len(shaped)]
    if flux.max() > 0:
        flux_p95 = np.percentile(flux[flux > 0], 95)
        flux_n = np.clip(flux / flux_p95, 0, 1)
    else:
        flux_n = np.zeros_like(shaped)
    shaped = shaped + flux_n * params["flux_weight"]

    # ── 4) 온셋 어택 + 디케이 ────────────────────────────────────────
    onset_frames = librosa.onset.onset_detect(y=y, sr=sr, hop_length=hop)
    valid = onset_frames[onset_frames < len(shaped)]
    onset_env = np.zeros_like(shaped)
    for oi in valid:
        decay_len = min(12, len(shaped) - oi)
        decay = np.exp(-np.arange(decay_len) * params["onset_decay"])
        onset_env[oi:oi+decay_len] = np.maximum(
            onset_env[oi:oi+decay_len], decay * params["onset_boost"]
        )
    shaped = shaped + onset_env

    # ── 5) 촉각 적응 보상 AM 변조 ────────────────────────────────────
    sustained = uniform_filter1d(shaped, size=max(1, int(fps * 0.3)))
    sustained_mask = sustained > 0.3
    t = np.arange(len(shaped)) / fps
    f1, f2 = params["am_freq1"], params["am_freq2"]
    depth = params["am_depth"]
    am = 1.0 + depth * np.sin(2*np.pi*f1*t) + (depth*0.5) * np.sin(2*np.pi*f2*t + 0.7)
    shaped = np.where(sustained_mask, shaped * am, shaped)

    # ── 6) 출력 매핑 ─────────────────────────────────────────────────
    shaped = np.clip(shaped, 0, 1)
    MIN_I = params["min_intensity"]
    intensity = (shaped * (255 - MIN_I) + MIN_I).astype(np.uint8)

    # 무음 처리
    silence_thresh = rms_max * params["silence_pct"]
    intensity[rms[:len(intensity)] < silence_thresh] = 0

    # 가벼운 스무딩
    intensity = uniform_filter1d(intensity.astype(float), size=2).astype(np.uint8)

    return intensity


# ═══════════════════════════════════════════════════════════════════════
# 메인 파이프라인
# ═══════════════════════════════════════════════════════════════════════
def audio_to_intensity_stereo(path: str, fps: int = 50):
    try:
        import librosa
    except ImportError:
        print("[ERR] pip install librosa scipy"); sys.exit(1)

    print(f"[LOAD] {path}")
    y, sr = librosa.load(path, sr=None, mono=False)

    if y.ndim == 1:
        print("[INFO] 모노 입력 → L/R 동일")
        y_l = y_r = y
    else:
        y_l, y_r = y[0], y[1]

    print(f"[INFO] sr={sr}Hz  길이={len(y_l)/sr:.2f}s\n")

    # ── 음원 분석 ────────────────────────────────────────────────────
    print("─── 음원 특성 분석 ───")
    # 분석은 모노 믹스 기준
    y_mono = y_l if y.ndim == 1 else librosa.to_mono(y)
    profile = analyze_audio(y_mono, sr, fps)

    for k, v in profile.items():
        print(f"  {k:20s}: {v}")

    # ── 파라미터 자동 결정 ────────────────────────────────────────────
    params = auto_params(profile)
    print(f"\n─── 자동 파라미터 ───")
    for k, v in params.items():
        print(f"  {k:20s}: {v}")
    print()

    # ── 변환 ─────────────────────────────────────────────────────────
    int_l = _process_channel(y_l, sr, fps, params)
    int_r = _process_channel(y_r, sr, fps, params)

    n = min(len(int_l), len(int_r))
    int_l, int_r = int_l[:n], int_r[:n]

    nz = int_l[int_l > 0]
    print(f"[RESULT] {n}프레임 ({n/fps:.1f}초)")
    if len(nz) > 0:
        print(f"  range: [{int_l.min()}, {int_l.max()}]")
        print(f"  mean={nz.mean():.0f}  median={np.median(nz):.0f}")
        print(f"  >200: {np.sum(int_l>200)/len(int_l)*100:.1f}%")
        print(f"  =0:   {np.sum(int_l==0)/len(int_l)*100:.1f}%")

    return int_l, int_r, profile, params


def save_bin(int_l, int_r, out_path, fps):
    n = len(int_l)
    payload = np.empty(n*2, dtype=np.uint8)
    payload[0::2] = int_l
    payload[1::2] = int_r
    header = struct.pack("<4sBHIB", MAGIC, 1, fps, n, CHANNELS)
    data = header + payload.tobytes()
    Path(out_path).write_bytes(data)
    print(f"\n[SAVE] {out_path} ({len(data)} bytes)")
    return data


def send_to_esp32(data, port, baudrate=921600, chunk_size=256, delay_s=0.003):
    try:
        import serial
    except ImportError:
        print("[ERR] pip install pyserial"); sys.exit(1)
    if data[:4] != MAGIC:
        print("[ERR] VIB1 헤더 없음"); sys.exit(1)
    _, ver, fps, n_frames, ch = struct.unpack_from("<4sBHIB", data, 0)
    print(f"\n[SEND] port={port} baud={baudrate}")
    print(f"[SEND] fps={fps} frames={n_frames} ch={ch} 재생={n_frames/fps:.1f}s")
    with serial.Serial(port, baudrate=baudrate, timeout=0.2, write_timeout=5) as ser:
        print("[SEND] ESP32 대기 (2초)...")
        time.sleep(2.0)
        ser.reset_input_buffer(); ser.reset_output_buffer()
        total, sent = len(data), 0
        print("[SEND] 전송 시작")
        while sent < total:
            end = min(sent + chunk_size, total)
            n = ser.write(data[sent:end]); ser.flush(); sent += n
            pct = sent / total * 100
            if pct % 10 < (chunk_size / total * 100):
                print(f"  {sent}/{total} ({pct:.0f}%)")
            time.sleep(delay_s)
        print("[SEND] 완료 — 로그 수신 (15초)\n")
        end_t = time.time() + 15
        while time.time() < end_t:
            if ser.in_waiting:
                print(ser.read(ser.in_waiting).decode("utf-8", errors="ignore"),
                      end="", flush=True)
            time.sleep(0.05)
    print("\n[DONE]")


def main():
    p = argparse.ArgumentParser(
        description="audio→haptic v3 (적응형 자동 튜닝)"
    )
    p.add_argument("input")
    p.add_argument("--out",       default=None)
    p.add_argument("--fps",       type=int, default=50)
    p.add_argument("--port",      default=None)
    p.add_argument("--baud",      type=int, default=921600)
    p.add_argument("--send-only", action="store_true")
    a = p.parse_args()
    inp = Path(a.input)

    if a.send_only:
        if not inp.exists(): print(f"[ERR] {inp}"); sys.exit(1)
        if not a.port: print("[ERR] --port 필요"); sys.exit(1)
        send_to_esp32(inp.read_bytes(), a.port, a.baud); return

    if inp.suffix.lower() not in SUPPORTED_AUDIO:
        print(f"[ERR] 지원: {SUPPORTED_AUDIO}"); sys.exit(1)

    out = a.out or str(inp.with_suffix(".bin"))

    print(f"\n{'='*55}")
    print(f"  audio_to_esp32 v3 — 적응형 자동 튜닝")
    print(f"  입력 : {inp}")
    print(f"  출력 : {out}")
    print(f"  fps  : {a.fps} Hz / 채널: {CHANNELS} (L/R)")
    print(f"{'='*55}\n")

    int_l, int_r, profile, params = audio_to_intensity_stereo(str(inp), a.fps)
    data = save_bin(int_l, int_r, out, a.fps)

    if a.port:
        send_to_esp32(data, a.port, a.baud)
    else:
        print(f"[INFO] 전송: python audio_to_esp32_v3.py {out} --port COM3 --send-only")


if __name__ == "__main__":
    main()
