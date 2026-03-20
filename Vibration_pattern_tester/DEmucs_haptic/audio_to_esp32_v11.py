"""
audio_to_esp32_v11.py
Demucs 4-stem 분리 + Sharpness 엔벨로프 + 이벤트 기반 햅틱

소스 분리:
  Demucs v4 → drums / bass / vocals / other (설치 시)
  Fallback  → Butterworth 3-band (Demucs 없을 때)

L motor = drums + bass  → 묵직한 펀치 (low sharpness)
R motor = vocals + other → 선명한 탭 (high sharpness)

Sharpness 구현 (엔벨로프 형태로):
  High sharpness: 1f attack + 2f sustain + 4f decay  (날카로운 "딱")
  Low sharpness:  3f attack + 3f sustain + 8f decay  (부드러운 "웅")

VIB2 포맷 (channels=2, bytes_per_frame=4):
  Header 12 bytes: magic(4) ver(2) fps(2LE) n_frames(4LE) channels(1)
  Payload: [L_int, L_sharp, R_int, R_sharp] × n_frames
  sharp: 0=smooth ... 255=crisp → ESP32에서 웨이브폼 선택에 사용

VIB1 호환 모드도 지원 (--format vib1)
"""

import argparse
import struct
import sys
import time
from pathlib import Path

import numpy as np

MAGIC_V1 = b"VIB1"
MAGIC_V2 = b"VIB2"
CHANNELS = 2
SUPPORTED_AUDIO = {".mp3", ".wav", ".flac", ".ogg", ".m4a"}


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


def _apply_env(output, start, env):
    for i in range(len(env)):
        idx = start + i
        if idx < len(output):
            output[idx] = max(output[idx], env[i])


def _apply_sharpness_env(sharp_arr, start, length, sharpness_val):
    """sharpness 배열에 값 기록 (max 합성)"""
    for i in range(min(length, len(sharp_arr) - start)):
        sharp_arr[start + i] = max(sharp_arr[start + i], sharpness_val)


# ═══════════════════════════════════════════════════════════════════════
# 소스 분리
# ═══════════════════════════════════════════════════════════════════════
def separate_demucs(path, sr_target=None):
    """Demucs v4로 4-stem 분리 → dict of numpy arrays"""
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

        print(f"[DEMUCS] 분리 중 (sr={model_sr}, {wav.shape[-1]/model_sr:.1f}s)...")
        with torch.no_grad():
            sources = apply_model(model, wav)

        stem_names = model.sources
        result = {}
        for i, name in enumerate(stem_names):
            stem = sources[0, i].mean(dim=0).numpy()
            result[name] = stem

        print(f"[DEMUCS] 완료: {list(result.keys())}")
        return result

    except Exception as e:
        print(f"[DEMUCS] 실행 실패 → 밴드패스 폴백: {e}")
        return None


def separate_bandpass(path, fps):
    """Butterworth 3-band 폴백"""
    import librosa
    from scipy.signal import butter, sosfilt

    print("[BAND] Demucs 없음 → Butterworth 폴백")
    y, sr = librosa.load(path, sr=None, mono=True)

    sos_lo = butter(4, 150, btype='low', fs=sr, output='sos')
    sos_mid = butter(4, [150, 500], btype='band', fs=sr, output='sos')
    sos_hi = butter(4, 500, btype='high', fs=sr, output='sos')

    return {
        'drums': sosfilt(sos_lo, y) * 1.5,  # 킥 부스트
        'bass': sosfilt(sos_lo, y),
        'vocals': sosfilt(sos_hi, y),
        'other': sosfilt(sos_mid, y),
        '_sr': sr,
        '_y': y,
    }


# ═══════════════════════════════════════════════════════════════════════
# 스템별 햅틱 변환
# ═══════════════════════════════════════════════════════════════════════
def process_stem(y_stem, y_full, sr, fps, stem_type):
    """
    stem_type: 'drums', 'bass', 'vocals', 'other'
    Returns: (intensity_array, sharpness_array)
    """
    import librosa
    from scipy.ndimage import uniform_filter1d

    hop = int(sr / fps)
    rms = librosa.feature.rms(y=y_stem, hop_length=hop)[0]
    rms_full = librosa.feature.rms(y=y_full, hop_length=hop)[0]
    n = min(len(rms), len(rms_full))
    rms, rms_full = rms[:n], rms_full[:n]

    r_max = np.max(rms) if np.max(rms) > 0 else 1
    silence_thresh = np.max(rms_full) * 0.015

    intensity = np.zeros(n, dtype=np.float64)
    sharpness = np.zeros(n, dtype=np.float64)

    # 온셋 검출
    onsets = librosa.onset.onset_detect(
        y=y_stem, sr=sr, hop_length=hop, backtrack=False)
    onsets = onsets[onsets < n]
    onset_str = librosa.onset.onset_strength(y=y_stem, sr=sr, hop_length=hop)[:n]
    oe_max = np.percentile(onset_str[onset_str > 0], 90) if np.any(onset_str > 0) else 1

    if stem_type == 'drums':
        # 드럼: 높은 강도, 높은 sharpness, 빠른 어택
        for oi in onsets:
            s = min(onset_str[oi] / oe_max * 1.5, 1.0)
            if s < 0.08: continue
            peak = 160 + s * 95  # 160~255
            # HIGH sharpness envelope: 빠른 어택 + 짧은 서스테인
            env = _make_envelope(peak, attack_f=1, sustain_f=2, decay_f=6, max_len=n-oi)
            _apply_env(intensity, oi, env)
            _apply_sharpness_env(sharpness, oi, len(env), 200 + s * 55)  # 200~255

    elif stem_type == 'bass':
        # 베이스: 중간 강도, 낮은 sharpness, 느린 어택
        for oi in onsets:
            s = min(onset_str[oi] / oe_max * 1.3, 1.0)
            if s < 0.1: continue
            peak = 100 + s * 100  # 100~200
            # LOW sharpness: 느린 어택 + 긴 디케이
            env = _make_envelope(peak, attack_f=3, sustain_f=3, decay_f=10, max_len=n-oi)
            _apply_env(intensity, oi, env)
            _apply_sharpness_env(sharpness, oi, len(env), 30 + s * 50)  # 30~80

    elif stem_type == 'vocals':
        # 보컬: 중간 강도, 중간 sharpness, 부드러운 어택
        for oi in onsets:
            s = min(onset_str[oi] / oe_max * 1.3, 1.0)
            if s < 0.08: continue
            peak = 80 + s * 120  # 80~200
            env = _make_envelope(peak, attack_f=2, sustain_f=2, decay_f=8, max_len=n-oi)
            _apply_env(intensity, oi, env)
            _apply_sharpness_env(sharpness, oi, len(env), 100 + s * 80)  # 100~180

    elif stem_type == 'other':
        # 기타 악기: 중간, 중간 sharpness
        for oi in onsets:
            s = min(onset_str[oi] / oe_max * 1.2, 1.0)
            if s < 0.1: continue
            peak = 60 + s * 100  # 60~160
            env = _make_envelope(peak, attack_f=2, sustain_f=2, decay_f=8, max_len=n-oi)
            _apply_env(intensity, oi, env)
            _apply_sharpness_env(sharpness, oi, len(env), 80 + s * 70)  # 80~150

    intensity[rms_full < silence_thresh] = 0
    sharpness[rms_full < silence_thresh] = 0
    intensity[intensity < 12] = 0
    sharpness[intensity < 12] = 0

    return intensity, sharpness


def convert(path, fps=50):
    import librosa

    # 소스 분리 시도
    stems = separate_demucs(path)
    if stems is None:
        stems = separate_bandpass(path, fps)

    # 풀 오디오 로드
    y_full, sr = librosa.load(path, sr=None, mono=True)
    hop = int(sr / fps)
    n = len(librosa.feature.rms(y=y_full, hop_length=hop)[0])

    # 스템별 처리
    results = {}
    for stem_name in ['drums', 'bass', 'vocals', 'other']:
        if stem_name in stems:
            y_stem = stems[stem_name]
            # 길이 맞추기
            min_len = min(len(y_stem), len(y_full))
            int_arr, sharp_arr = process_stem(
                y_stem[:min_len], y_full[:min_len], sr, fps, stem_name)
            results[stem_name] = (int_arr[:n], sharp_arr[:n])
            print(f"  [{stem_name:6s}] events={np.sum(int_arr>0)} "
                  f"peak={int_arr.max():.0f} "
                  f"sharp_mean={sharp_arr[sharp_arr>0].mean():.0f}" if np.any(sharp_arr>0) else f"  [{stem_name:6s}] silent")

    # L motor = drums + bass
    int_l = np.zeros(n); sharp_l = np.zeros(n)
    for stem in ['drums', 'bass']:
        if stem in results:
            si, ss = results[stem]
            for i in range(min(n, len(si))):
                if si[i] > int_l[i]:
                    int_l[i] = si[i]
                    sharp_l[i] = ss[i]

    # R motor = vocals + other
    int_r = np.zeros(n); sharp_r = np.zeros(n)
    for stem in ['vocals', 'other']:
        if stem in results:
            si, ss = results[stem]
            for i in range(min(n, len(si))):
                if si[i] > int_r[i]:
                    int_r[i] = si[i]
                    sharp_r[i] = ss[i]

    int_l = np.clip(int_l, 0, 255).astype(np.uint8)
    int_r = np.clip(int_r, 0, 255).astype(np.uint8)
    sharp_l = np.clip(sharp_l, 0, 255).astype(np.uint8)
    sharp_r = np.clip(sharp_r, 0, 255).astype(np.uint8)

    # 통계
    corr = np.corrcoef(int_l.astype(float), int_r.astype(float))[0,1]
    sl = int(np.sum(int_l == 0))
    sr_ = int(np.sum(int_r == 0))

    print(f"\n[RESULT] {n}프레임 ({n/fps:.1f}초)")
    print(f"  L (drums+bass):   [{int_l.min()},{int_l.max()}] "
          f"silence={sl/n*100:.0f}% sharp_mean={sharp_l[sharp_l>0].mean():.0f}" if np.any(sharp_l>0) else "")
    print(f"  R (vocals+other): [{int_r.min()},{int_r.max()}] "
          f"silence={sr_/n*100:.0f}% sharp_mean={sharp_r[sharp_r>0].mean():.0f}" if np.any(sharp_r>0) else "")
    print(f"  L/R corr: {corr:.2f}")

    return int_l, sharp_l, int_r, sharp_r


def save_vib2(int_l, sharp_l, int_r, sharp_r, out_path, fps):
    """VIB2 포맷: [L_int, L_sharp, R_int, R_sharp] per frame"""
    n = len(int_l)
    payload = np.empty(n * 4, dtype=np.uint8)
    payload[0::4] = int_l
    payload[1::4] = sharp_l
    payload[2::4] = int_r
    payload[3::4] = sharp_r
    header = struct.pack("<4sBHIB", MAGIC_V2, 2, fps, n, CHANNELS)
    data = header + payload.tobytes()
    Path(out_path).write_bytes(data)
    print(f"[SAVE] {out_path} ({len(data)} bytes, VIB2)")
    return data


def save_vib1(int_l, int_r, out_path, fps):
    """VIB1 호환: [L_int, R_int] per frame (sharpness 무시)"""
    n = len(int_l)
    payload = np.empty(n * 2, dtype=np.uint8)
    payload[0::2] = int_l
    payload[1::2] = int_r
    header = struct.pack("<4sBHIB", MAGIC_V1, 1, fps, n, CHANNELS)
    data = header + payload.tobytes()
    Path(out_path).write_bytes(data)
    print(f"[SAVE] {out_path} ({len(data)} bytes, VIB1 compat)")
    return data


def send_to_esp32(data, port, baudrate=921600, chunk_size=256, delay_s=0.003):
    try:
        import serial
    except ImportError:
        print("[ERR] pip install pyserial"); sys.exit(1)
    magic = data[:4]
    if magic not in (MAGIC_V1, MAGIC_V2):
        print("[ERR] VIB1/VIB2 헤더 없음"); sys.exit(1)
    _, ver, fps, nf, ch = struct.unpack_from("<4sBHIB", data, 0)
    bpf = 4 if magic == MAGIC_V2 else 2
    print(f"\n[SEND] port={port} format={'VIB2' if bpf==4 else 'VIB1'} "
          f"fps={fps} frames={nf} 재생={nf/fps:.1f}s")
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
        description="audio→haptic v11 (Demucs + sharpness)")
    p.add_argument("input")
    p.add_argument("--out", default=None)
    p.add_argument("--fps", type=int, default=50)
    p.add_argument("--format", choices=["vib1", "vib2"], default="vib2",
                   help="출력 포맷 (vib2=sharpness 포함, vib1=호환)")
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
    print(f"  audio_to_esp32 v11 — Demucs + sharpness")
    print(f"  L = drums + bass (low sharpness)")
    print(f"  R = vocals + other (high sharpness)")
    print(f"  format: {a.format}")
    print(f"  입력: {inp}  출력: {out}")
    print(f"{'='*55}\n")

    int_l, sharp_l, int_r, sharp_r = convert(str(inp), a.fps)

    if a.format == "vib2":
        data = save_vib2(int_l, sharp_l, int_r, sharp_r, out, a.fps)
    else:
        data = save_vib1(int_l, int_r, out, a.fps)

    if a.port:
        send_to_esp32(data, a.port, a.baud)
    else:
        print(f"\n[INFO] 전송: python audio_to_esp32_v11.py {out} --port COM3 --send-only")


if __name__ == "__main__":
    main()