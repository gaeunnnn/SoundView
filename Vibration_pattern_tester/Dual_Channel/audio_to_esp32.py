"""
audio_to_esp32_v10.py
3밴드 + 비트 + 센트로이드 (기저 없음, 이벤트 전용)

원칙: 기본 = 무음(0). 이벤트만 진동.
  - 이벤트 디케이를 길게 → 자연스럽게 겹쳐서 빈 구간 줄임
  - 기저/크레센도 레이어 완전 제거 → 잔진동 없음

L motor = 킥 (<150Hz) + 비트 정렬 + 센트로이드(dark=boost)
R motor = 멜로디 (>500Hz) + 노트 탭 + 센트로이드(bright=boost)
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
DEFAULT_LOW_CUT  = 150
DEFAULT_HIGH_CUT = 500


def _make_envelope(peak, attack_f, sustain_f, decay_f, max_len):
    total = min(attack_f + sustain_f + decay_f, max_len)
    if total <= 0:
        return np.array([])
    env = np.zeros(total)
    atk = min(attack_f, total)
    if atk > 0:
        env[:atk] = np.linspace(peak * 0.3, peak, atk)
    sus_end = min(atk + sustain_f, total)
    env[atk:sus_end] = peak
    dec_start = sus_end
    dec_len = total - dec_start
    if dec_len > 0:
        env[dec_start:] = peak * np.exp(-np.arange(dec_len) * 2.5 / max(dec_len, 1))
    return env


def _apply_envelope(output, start, env):
    for i in range(len(env)):
        idx = start + i
        if idx < len(output):
            output[idx] = max(output[idx], env[i])


def convert(path, fps=50, low_cut=DEFAULT_LOW_CUT, high_cut=DEFAULT_HIGH_CUT):
    try:
        import librosa
        from scipy.signal import butter, sosfilt
        from scipy.ndimage import uniform_filter1d
    except ImportError:
        print("[ERR] pip install librosa scipy"); sys.exit(1)

    print(f"[LOAD] {path}")
    y, sr = librosa.load(path, sr=None, mono=True)
    hop = int(sr / fps)
    n = len(librosa.feature.rms(y=y, hop_length=hop)[0])
    print(f"[INFO] sr={sr}Hz  {len(y)/sr:.2f}s  {n}frames")

    # ── 3밴드 분리 ───────────────────────────────────────────────────
    print(f"[BAND] low<{low_cut} | mid {low_cut}~{high_cut} | high>{high_cut}")

    sos_lo = butter(4, low_cut, btype='low', fs=sr, output='sos')
    sos_mid = butter(4, [low_cut, high_cut], btype='band', fs=sr, output='sos')
    sos_hi = butter(4, high_cut, btype='high', fs=sr, output='sos')

    y_lo = sosfilt(sos_lo, y)
    y_mid = sosfilt(sos_mid, y)
    y_hi = sosfilt(sos_hi, y)

    rms_lo = librosa.feature.rms(y=y_lo, hop_length=hop)[0][:n]
    rms_mid = librosa.feature.rms(y=y_mid, hop_length=hop)[0][:n]
    rms_hi = librosa.feature.rms(y=y_hi, hop_length=hop)[0][:n]
    rms_full = librosa.feature.rms(y=y, hop_length=hop)[0][:n]
    silence_thresh = np.max(rms_full) * 0.015

    lo_max = np.max(rms_lo) if np.max(rms_lo) > 0 else 1
    mid_max = np.max(rms_mid) if np.max(rms_mid) > 0 else 1
    hi_max = np.max(rms_hi) if np.max(rms_hi) > 0 else 1

    # ── 비트 트래킹 ─────────────────────────────────────────────────
    tempo, beat_frames = librosa.beat.beat_track(y=y, sr=sr, hop_length=hop)
    tempo_val = float(np.atleast_1d(tempo)[0])
    beat_frames = beat_frames[beat_frames < n]
    print(f"[BEAT] {tempo_val:.0f}BPM  {len(beat_frames)} beats")

    # ── 센트로이드 ───────────────────────────────────────────────────
    centroid = librosa.feature.spectral_centroid(y=y, sr=sr, hop_length=hop)[0][:n]
    c_nz = centroid[centroid > 0]
    c_min = np.percentile(c_nz, 5) if len(c_nz) > 0 else 0
    c_max = np.percentile(c_nz, 95) if len(c_nz) > 0 else 1
    c_norm = np.clip((centroid - c_min) / (c_max - c_min + 1e-6), 0, 1)
    c_smooth = uniform_filter1d(c_norm, size=int(fps * 0.15))
    print(f"[CENT] {c_min:.0f}~{c_max:.0f}Hz")

    # ═══════════════════════════════════════════════════════════════════
    # L motor: 킥/베이스 이벤트 (기저 없음)
    # ═══════════════════════════════════════════════════════════════════
    out_l = np.zeros(n, dtype=np.float64)

    # L 비트 킥: 비트 프레임에서 묵직한 펀치
    # 긴 디케이 (200ms sustain + 250ms decay = 450ms total)
    beat_set = set(beat_frames.tolist())
    for bi in beat_frames:
        lo_strength = min(rms_lo[bi] / lo_max * 2.0, 1.0)
        mid_add = rms_mid[bi] / mid_max * 0.3  # mid 밴드도 약간 반영
        strength = min(lo_strength + mid_add, 1.0)
        if strength < 0.05:
            continue
        # 센트로이드: 어두울수록 L 부스트
        dark_factor = 1.0 + (1.0 - c_smooth[bi]) * 0.2  # 1.0~1.2
        peak = (140 + strength * 115) * dark_factor  # 140~255
        peak = min(peak, 255)
        # 모터 물리: 어택1f + 서스테인3f + 긴 디케이10f (=280ms)
        env = _make_envelope(peak, attack_f=1, sustain_f=3, decay_f=10, max_len=n - bi)
        _apply_envelope(out_l, bi, env)

    # L 비비트 저음 온셋 (비트 외 추가 킥)
    lo_onsets = librosa.onset.onset_detect(y=y_lo, sr=sr, hop_length=hop, backtrack=False)
    lo_onsets = lo_onsets[lo_onsets < n]
    lo_oe = librosa.onset.onset_strength(y=y_lo, sr=sr, hop_length=hop)[:n]
    lo_oe_max = np.percentile(lo_oe[lo_oe > 0], 90) if np.any(lo_oe > 0) else 1

    for oi in lo_onsets:
        if any(abs(oi - b) <= 3 for b in beat_set):
            continue
        strength = min(lo_oe[oi] / lo_oe_max * 1.3, 1.0)
        if strength < 0.12:
            continue
        dark_factor = 1.0 + (1.0 - c_smooth[oi]) * 0.15
        peak = min((90 + strength * 90) * dark_factor, 200)  # 90~200
        # 비비트는 약간 짧게
        env = _make_envelope(peak, attack_f=1, sustain_f=2, decay_f=7, max_len=n - oi)
        _apply_envelope(out_l, oi, env)

    # L mid 밴드 온셋 (저음이 약한 구간에서 mid로 보충)
    mid_onsets = librosa.onset.onset_detect(y=y_mid, sr=sr, hop_length=hop, backtrack=False)
    mid_onsets = mid_onsets[mid_onsets < n]
    for oi in mid_onsets:
        if out_l[oi] > 60:  # 이미 킥이 있으면 스킵
            continue
        strength = min(rms_mid[oi] / mid_max * 1.2, 1.0)
        if strength < 0.15:
            continue
        peak = 50 + strength * 70  # 50~120
        env = _make_envelope(peak, attack_f=2, sustain_f=2, decay_f=6, max_len=n - oi)
        _apply_envelope(out_l, oi, env)

    # ═══════════════════════════════════════════════════════════════════
    # R motor: 멜로디/보컬 이벤트 (기저 없음)
    # ═══════════════════════════════════════════════════════════════════
    out_r = np.zeros(n, dtype=np.float64)

    # R 고음 노트 탭 (긴 디케이)
    hi_onsets = librosa.onset.onset_detect(y=y_hi, sr=sr, hop_length=hop, backtrack=False)
    hi_onsets = hi_onsets[hi_onsets < n]
    hi_oe = librosa.onset.onset_strength(y=y_hi, sr=sr, hop_length=hop)[:n]
    hi_oe_max = np.percentile(hi_oe[hi_oe > 0], 90) if np.any(hi_oe > 0) else 1

    for oi in hi_onsets:
        strength = min(hi_oe[oi] / hi_oe_max * 1.3, 1.0)
        if strength < 0.08:
            continue
        # 센트로이드: 밝을수록 R 부스트
        bright_factor = 1.0 + c_smooth[oi] * 0.2  # 1.0~1.2
        peak = min((80 + strength * 120) * bright_factor, 200)  # 80~200
        # 멜로디: 소프트 어택 + 긴 서스테인 + 긴 디케이 (총 ~360ms)
        env = _make_envelope(peak, attack_f=2, sustain_f=3, decay_f=13, max_len=n - oi)
        _apply_envelope(out_r, oi, env)

    # R mid 밴드 보충 (고음이 약한 구간)
    for oi in mid_onsets:
        if out_r[oi] > 50:
            continue
        strength = min(rms_mid[oi] / mid_max * 1.0, 1.0)
        if strength < 0.15:
            continue
        peak = 40 + strength * 60  # 40~100
        env = _make_envelope(peak, attack_f=2, sustain_f=2, decay_f=8, max_len=n - oi)
        _apply_envelope(out_r, oi, env)

    # ═══════════════════════════════════════════════════════════════════
    # 최종
    # ═══════════════════════════════════════════════════════════════════
    out_l[rms_full < silence_thresh] = 0
    out_r[rms_full < silence_thresh] = 0

    int_l = np.clip(out_l, 0, 255).astype(np.uint8)
    int_r = np.clip(out_r, 0, 255).astype(np.uint8)

    # 통계
    corr = np.corrcoef(int_l.astype(float), int_r.astype(float))[0, 1]
    sil_l = int(np.sum(int_l == 0))
    sil_r = int(np.sum(int_r == 0))
    evt_l = int(np.sum(int_l > 80))
    evt_r = int(np.sum(int_r > 80))
    nz_l = int_l[int_l > 0]
    nz_r = int_r[int_r > 0]

    print(f"\n[RESULT] {n}프레임 ({n/fps:.1f}초)")
    print(f"  L: silence={sil_l}({sil_l/n*100:.0f}%) events(>80)={evt_l}({evt_l/n*100:.0f}%) mean={nz_l.mean():.0f}")
    print(f"  R: silence={sil_r}({sil_r/n*100:.0f}%) events(>80)={evt_r}({evt_r/n*100:.0f}%) mean={nz_r.mean():.0f}")
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
            end = min(sent + chunk_size, total)
            w = ser.write(data[sent:end]); ser.flush(); sent += w
            pct = sent / total * 100
            if pct % 10 < (chunk_size / total * 100):
                print(f"  {sent}/{total} ({pct:.0f}%)")
            time.sleep(delay_s)
        print("[SEND] 완료 — 로그 (15초)\n")
        end_t = time.time() + 15
        while time.time() < end_t:
            if ser.in_waiting:
                print(ser.read(ser.in_waiting).decode("utf-8", errors="ignore"),
                      end="", flush=True)
            time.sleep(0.05)
    print("\n[DONE]")


def main():
    p = argparse.ArgumentParser(description="audio→haptic v10 (event-only + 3band + beat + centroid)")
    p.add_argument("input")
    p.add_argument("--out", default=None)
    p.add_argument("--fps", type=int, default=50)
    p.add_argument("--low-cut", type=int, default=DEFAULT_LOW_CUT, help="kick cutoff (default: 150)")
    p.add_argument("--high-cut", type=int, default=DEFAULT_HIGH_CUT, help="melody cutoff (default: 500)")
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
    print(f"  audio_to_esp32 v10 — event-only + 3band/beat/centroid")
    print(f"  NO base vibration. Events only.")
    print(f"  L = kick (<{a.low_cut}Hz) + beat")
    print(f"  R = melody (>{a.high_cut}Hz) + brightness")
    print(f"  입력: {inp}  출력: {out}")
    print(f"{'='*55}\n")

    int_l, int_r = convert(str(inp), a.fps, a.low_cut, a.high_cut)
    data = save_bin(int_l, int_r, out, a.fps)
    if a.port:
        send_to_esp32(data, a.port, a.baud)
    else:
        print(f"\n[INFO] 전송: python audio_to_esp32_v10.py {out} --port COM3 --send-only")


if __name__ == "__main__":
    main()