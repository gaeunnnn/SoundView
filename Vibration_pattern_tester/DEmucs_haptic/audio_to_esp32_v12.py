"""
audio_to_esp32_v12.py
Demucs 4-stem + 커스텀 RTP 엔벨로프 (라이브러리 불필요)

엔벨로프 설계 원칙:
  - 오버슈트: 목표보다 높게 시작 → 모터가 빠르게 도달
  - 하드 컷오프: 갑자기 0 → DRV2605L 브레이킹으로 "딱" 끊김
  - 바운스: 메인 히트 → 컷 → 약한 리바운드 (스네어 느낌)

스템별 엔벨로프:
  drums  → SHARP: [overshoot, max, max, 0, 0...] 선명한 타격
  bass   → PUNCH: [ramp, ramp, max, sustain, decay...] 묵직한 펀치
  vocals → SMOOTH: [ramp, sustain, long_decay...] 부드러운 탭
  other  → MEDIUM: [ramp, sustain, decay...] 중간

출력: VIB1 (순수 RTP, v2 펌웨어 호환)
"""

import argparse
import struct
import sys
import time
from pathlib import Path

import numpy as np

MAGIC   = b"VIB1"
CHANNELS = 2
SUPPORTED_AUDIO = {".mp3", ".wav", ".flac", ".ogg", ".m4a"}


# ═══════════════════════════════════════════════════════════════════════
# 엔벨로프 템플릿 (모터 물리 + 브레이킹 반영)
# ═══════════════════════════════════════════════════════════════════════
def make_sharp_env(peak, max_len):
    """드럼용: 오버슈트 → 서스테인 → 하드 컷오프(브레이킹)"""
    # 3f sustain → 모터 피크 도달 → 0 → 브레이킹 "딱"
    template = np.array([1.0, 1.0, 1.0, 0, 0, 0, 0, 0])
    n = min(len(template), max_len)
    return template[:n] * peak


def make_bounce_env(peak, max_len):
    """스네어/하이햇용: 히트 → 컷 → 리바운드"""
    # 메인 히트 → 브레이크 → 약한 2차 히트
    template = np.array([1.0, 1.0, 0, 0, 0.35, 0.35, 0, 0, 0, 0])
    n = min(len(template), max_len)
    return template[:n] * peak


def make_punch_env(peak, max_len):
    """베이스용: 램프업 → 서스테인 → 점진 디케이"""
    template = np.array([0.7, 0.9, 1.0, 0.8, 0.5, 0.25, 0.1, 0, 0, 0])
    n = min(len(template), max_len)
    return template[:n] * peak


def make_smooth_env(peak, max_len):
    """보컬용: 느린 어택 → 느린 디케이"""
    template = np.array([0.2, 0.5, 0.8, 1.0, 0.9, 0.7, 0.5, 0.3, 0.15, 0.05, 0, 0])
    n = min(len(template), max_len)
    return template[:n] * peak


def make_medium_env(peak, max_len):
    """기타 악기용: 중간 어택 + 중간 디케이"""
    template = np.array([0.5, 0.9, 1.0, 0.8, 0.5, 0.3, 0.1, 0, 0, 0])
    n = min(len(template), max_len)
    return template[:n] * peak


ENV_MAP = {
    'drums':  make_sharp_env,
    'bass':   make_punch_env,
    'vocals': make_smooth_env,
    'other':  make_medium_env,
}


def _apply_env(output, start, env):
    for i in range(len(env)):
        idx = start + i
        if idx < len(output):
            output[idx] = max(output[idx], env[i])


# ═══════════════════════════════════════════════════════════════════════
# 소스 분리
# ═══════════════════════════════════════════════════════════════════════
def separate_demucs(path):
    try:
        import torch
        import librosa
        from demucs.pretrained import get_model
        from demucs.apply import apply_model
    except ImportError:
        return None

    try:
        print("[DEMUCS] 모델 로드 중...")
        model = get_model('htdemucs')
        model.eval()
        model_sr = model.samplerate

        print("[DEMUCS] 오디오 로드 (librosa)...")
        y, sr = librosa.load(path, sr=model_sr, mono=False)
        if y.ndim == 1:
            wav = torch.from_numpy(np.stack([y, y])).float()
        else:
            wav = torch.from_numpy(y).float()
        wav = wav.unsqueeze(0)

        print(f"[DEMUCS] 분리 중 ({wav.shape[-1]/model_sr:.1f}s)...")
        with torch.no_grad():
            sources = apply_model(model, wav)

        result = {}
        for i, name in enumerate(model.sources):
            result[name] = sources[0, i].mean(dim=0).numpy()

        print(f"[DEMUCS] 완료: {list(result.keys())}")
        return result

    except Exception as e:
        print(f"[DEMUCS] 실패 → 폴백: {e}")
        return None


def separate_bandpass(path):
    import librosa
    from scipy.signal import butter, sosfilt

    print("[BAND] Butterworth 3-band 폴백")
    y, sr = librosa.load(path, sr=None, mono=True)
    sos_lo = butter(4, 150, btype='low', fs=sr, output='sos')
    sos_mid = butter(4, [150, 500], btype='band', fs=sr, output='sos')
    sos_hi = butter(4, 500, btype='high', fs=sr, output='sos')
    return {
        'drums': sosfilt(sos_lo, y) * 1.5,
        'bass': sosfilt(sos_lo, y),
        'vocals': sosfilt(sos_hi, y),
        'other': sosfilt(sos_mid, y),
    }


# ═══════════════════════════════════════════════════════════════════════
# 스템별 변환
# ═══════════════════════════════════════════════════════════════════════
def process_stem(y_stem, y_full, sr, fps, stem_type, gain=1.0):
    import librosa

    hop = int(sr / fps)
    rms = librosa.feature.rms(y=y_stem, hop_length=hop)[0]
    rms_full = librosa.feature.rms(y=y_full, hop_length=hop)[0]
    n = min(len(rms), len(rms_full))
    rms, rms_full = rms[:n], rms_full[:n]

    r_max = np.max(rms) if np.max(rms) > 0 else 1
    silence_thresh = np.max(rms_full) * 0.015
    output = np.zeros(n, dtype=np.float64)

    # 온셋 검출
    onsets = librosa.onset.onset_detect(
        y=y_stem, sr=sr, hop_length=hop, backtrack=False)
    onsets = onsets[onsets < n]
    onset_str = librosa.onset.onset_strength(y=y_stem, sr=sr, hop_length=hop)[:n]
    oe_max = np.percentile(onset_str[onset_str > 0], 90) if np.any(onset_str > 0) else 1

    # 비트 트래킹 (drums에서만 사용)
    beat_set = set()
    if stem_type == 'drums':
        tempo, beat_frames = librosa.beat.beat_track(y=y_stem, sr=sr, hop_length=hop)
        beat_set = set(beat_frames[beat_frames < n].tolist())

    # 스템별 피크 범위 + 엔벨로프 함수
    env_fn = ENV_MAP.get(stem_type, make_medium_env)
    if stem_type == 'drums':
        PEAK_MIN, PEAK_MAX = 160, 255
        threshold = 0.08
    elif stem_type == 'bass':
        PEAK_MIN, PEAK_MAX = 100, 200
        threshold = 0.10
    elif stem_type == 'vocals':
        PEAK_MIN, PEAK_MAX = 80, 200
        threshold = 0.08
    else:
        PEAK_MIN, PEAK_MAX = 60, 160
        threshold = 0.10

    for oi in onsets:
        strength = min(onset_str[oi] / oe_max * 1.3, 1.0)
        if strength < threshold:
            continue

        peak = (PEAK_MIN + strength * (PEAK_MAX - PEAK_MIN)) * gain

        # 드럼: 비트 위치면 바운스, 아니면 샤프
        if stem_type == 'drums':
            if any(abs(oi - b) <= 2 for b in beat_set):
                env = make_bounce_env(peak, n - oi)
            else:
                env = make_sharp_env(peak, n - oi)
        else:
            env = env_fn(peak, n - oi)

        _apply_env(output, oi, env)

    output[rms_full < silence_thresh] = 0
    output[output < 12] = 0
    return np.clip(output, 0, 255).astype(np.uint8)


# ═══════════════════════════════════════════════════════════════════════
# 메인 변환
# ═══════════════════════════════════════════════════════════════════════
def convert(path, fps=50, l_gain=1.0, r_gain=1.0):
    import librosa

    stems = separate_demucs(path)
    if stems is None:
        stems = separate_bandpass(path)

    y_full, sr = librosa.load(path, sr=None, mono=True)
    hop = int(sr / fps)
    n = len(librosa.feature.rms(y=y_full, hop_length=hop)[0])

    gain_map = {'drums': l_gain, 'bass': l_gain,
                'vocals': r_gain, 'other': r_gain}
    results = {}
    for stem_name in ['drums', 'bass', 'vocals', 'other']:
        if stem_name in stems:
            y_stem = stems[stem_name]
            min_len = min(len(y_stem), len(y_full))
            arr = process_stem(y_stem[:min_len], y_full[:min_len],
                              sr, fps, stem_name, gain=gain_map[stem_name])
            results[stem_name] = arr[:n]
            nz = arr[arr > 0]
            evt = int(np.sum(arr > 80))
            print(f"  [{stem_name:6s}] events={evt} peak={arr.max()}"
                  + (f" mean={nz.mean():.0f}" if len(nz) > 0 else ""))

    # L = drums + bass
    int_l = np.zeros(n, dtype=np.uint8)
    for stem in ['drums', 'bass']:
        if stem in results:
            int_l = np.maximum(int_l, results[stem][:n])

    # R = vocals + other
    int_r = np.zeros(n, dtype=np.uint8)
    for stem in ['vocals', 'other']:
        if stem in results:
            int_r = np.maximum(int_r, results[stem][:n])

    corr = np.corrcoef(int_l.astype(float), int_r.astype(float))[0, 1]
    sl = int(np.sum(int_l == 0))
    sr_ = int(np.sum(int_r == 0))

    print(f"\n[RESULT] {n}프레임 ({n/fps:.1f}초)")
    nzl = int_l[int_l > 0]
    nzr = int_r[int_r > 0]
    print(f"  L (drums+bass):   [{int_l.min()},{int_l.max()}] "
          f"mean={nzl.mean():.0f} silence={sl/n*100:.0f}%" if len(nzl) > 0 else f"  L: silent")
    print(f"  R (vocals+other): [{int_r.min()},{int_r.max()}] "
          f"mean={nzr.mean():.0f} silence={sr_/n*100:.0f}%" if len(nzr) > 0 else f"  R: silent")
    print(f"  L/R corr: {corr:.2f}")

    return int_l, int_r


def save_bin(int_l, int_r, out_path, fps):
    n = len(int_l)
    payload = np.empty(n * 2, dtype=np.uint8)
    payload[0::2] = int_l
    payload[1::2] = int_r
    header = struct.pack("<4sBHIB", MAGIC, 1, fps, n, CHANNELS)
    data = header + payload.tobytes()
    Path(out_path).write_bytes(data)
    print(f"[SAVE] {out_path} ({len(data)} bytes)")
    return data


def send_to_esp32(data, port, baudrate=921600, chunk_size=256, delay_s=0.003):
    try:
        import serial
    except ImportError:
        print("[ERR] pip install pyserial"); sys.exit(1)
    if data[:4] != MAGIC:
        print("[ERR] VIB1 헤더 없음"); sys.exit(1)
    _, ver, fps, nf, ch = struct.unpack_from("<4sBHIB", data, 0)
    print(f"\n[SEND] port={port} fps={fps} frames={nf} 재생={nf/fps:.1f}s")
    with serial.Serial(port, baudrate=baudrate, timeout=0.2, write_timeout=5) as ser:
        print("[SEND] ESP32 대기 (2초)..."); time.sleep(2.0)
        ser.reset_input_buffer(); ser.reset_output_buffer()
        total, sent = len(data), 0
        while sent < total:
            end = min(sent+chunk_size, total)
            w = ser.write(data[sent:end]); ser.flush(); sent += w
            pct = sent/total*100
            if pct % 10 < (chunk_size/total*100):
                print(f"  {sent}/{total} ({pct:.0f}%)")
            time.sleep(delay_s)
        print("[SEND] 완료 — 로그 (15초)\n")
        end_t = time.time()+15
        while time.time() < end_t:
            if ser.in_waiting:
                print(ser.read(ser.in_waiting).decode("utf-8",errors="ignore"),
                      end="",flush=True)
            time.sleep(0.05)
    print("\n[DONE]")


def main():
    p = argparse.ArgumentParser(
        description="audio→haptic v12 (custom RTP envelopes, no library)")
    p.add_argument("input")
    p.add_argument("--out", default=None)
    p.add_argument("--fps", type=int, default=50)
    p.add_argument("--l-gain", type=float, default=1.0,
                   help="L (drums+bass) gain (default: 1.0)")
    p.add_argument("--r-gain", type=float, default=1.0,
                   help="R (vocals+other) gain (default: 1.0)")
    p.add_argument("--port", default=None)
    p.add_argument("--baud", type=int, default=921600)
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
    print(f"  audio_to_esp32 v12 — custom RTP envelopes")
    print(f"  VIB1 format (pure RTP, no library)")
    print(f"  L = drums({a.l_gain:.1f}) + bass({a.l_gain:.1f})")
    print(f"  R = vocals({a.r_gain:.1f}) + other({a.r_gain:.1f})")
    print(f"  입력: {inp}  출력: {out}")
    print(f"{'='*55}\n")

    int_l, int_r = convert(str(inp), a.fps, a.l_gain, a.r_gain)
    data = save_bin(int_l, int_r, out, a.fps)

    if a.port:
        send_to_esp32(data, a.port, a.baud)
    else:
        print(f"\n[INFO] 전송: python audio_to_esp32_v12.py {out} --port COM3 --send-only")


if __name__ == "__main__":
    main()
