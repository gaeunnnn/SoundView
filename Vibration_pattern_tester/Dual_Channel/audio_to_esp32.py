"""
audio_to_esp32.py
MP3/WAV → L/R 진동 패턴 변환 → ESP32 시리얼 전송 통합 스크립트

VIB1 포맷 (channels=2):
  Header 12 bytes: magic(4) ver(1) fps(2LE) n_frames(4LE) channels(1)
  Payload: [L0, R0, L1, R1, ...] uint8 × n_frames × 2

사용법:
  # 변환만
  python audio_to_esp32.py alarm.mp3 --out alarm.bin

  # 변환 + 즉시 전송
  python audio_to_esp32.py alarm.mp3 --port COM3

  # 기존 bin 파일만 전송
  python audio_to_esp32.py alarm.bin --port COM3 --send-only
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


# ── 단일 채널 오디오 → intensity ────────────────────────────────────
def _process_channel(y: np.ndarray, sr: int, fps: int) -> np.ndarray:
    from scipy.ndimage import uniform_filter1d
    import librosa

    hop = int(sr / fps)

    rms = librosa.feature.rms(y=y, hop_length=hop)[0]
    db  = librosa.amplitude_to_db(rms, ref=1.0)

    # 실제 음원 범위 기준으로 정규화 (고정 범위 대신)
    p5  = np.percentile(db, 5)
    p95 = np.percentile(db, 95)
    db_clipped = np.clip(db, p5, p95)
    norm = (db_clipped - p5) / (p95 - p5 + 1e-6)

    # tanh soft-clipping
    TANH_SCALE = 2.5
    shaped = np.tanh(TANH_SCALE * norm) / np.tanh(TANH_SCALE)

    # 온셋 boost
    onset_frames = librosa.onset.onset_detect(y=y, sr=sr, hop_length=hop)
    valid_onsets = onset_frames[onset_frames < len(shaped)]
    shaped[valid_onsets] = np.minimum(shaped[valid_onsets] * 1.4, 1.0)

    # 스무딩
    shaped = uniform_filter1d(shaped, size=3)

    # 0~255 + 원본 무음 구간 = 0
    intensity = (shaped * 255).astype(np.uint8)
    silence_mask = (db <= p5 + (p95 - p5) * 0.05)  # 하위 5% 무음 처리
    intensity[silence_mask] = 0

    return intensity


# ── 스테레오 오디오 → L/R intensity ─────────────────────────────────
def audio_to_intensity_stereo(path: str, fps: int = 50):
    try:
        import librosa
    except ImportError:
        print("[ERR] 필요 패키지 없음: pip install librosa scipy")
        sys.exit(1)

    print(f"[CONV] 로드 중: {path}")
    y, sr = librosa.load(path, sr=None, mono=False)

    if y.ndim == 1:
        # 모노 파일 → 양 채널 동일
        print("[CONV] 모노 입력 → L/R 동일 처리")
        y_l = y_r = y
    else:
        y_l = y[0]
        y_r = y[1]

    print(f"[CONV] sr={sr}Hz  길이={len(y_l)/sr:.2f}s")

    int_l = _process_channel(y_l, sr, fps)
    int_r = _process_channel(y_r, sr, fps)

    # 길이 맞추기
    n = min(len(int_l), len(int_r))
    int_l = int_l[:n]
    int_r = int_r[:n]

    duration_s = n / fps
    print(f"[CONV] 완료: {n}프레임 ({duration_s:.1f}초)")
    print(f"[CONV]  L: min={int_l.min()}  max={int_l.max()}  "
          f"평균={int_l[int_l > 0].mean():.1f}")
    print(f"[CONV]  R: min={int_r.min()}  max={int_r.max()}  "
          f"평균={int_r[int_r > 0].mean():.1f}")

    return int_l, int_r


# ── bin 파일 저장 (channels=2, interleaved L/R) ──────────────────────
def save_bin(int_l: np.ndarray, int_r: np.ndarray, out_path: str, fps: int):
    n_frames = len(int_l)

    # payload: [L0, R0, L1, R1, ...]
    payload = np.empty(n_frames * 2, dtype=np.uint8)
    payload[0::2] = int_l
    payload[1::2] = int_r

    header = struct.pack("<4sBHIB", MAGIC, 1, fps, n_frames, CHANNELS)
    data   = header + payload.tobytes()

    Path(out_path).write_bytes(data)
    print(f"[SAVE] {out_path} ({len(data)} bytes, channels={CHANNELS})")
    return data


# ── ESP32 시리얼 전송 ────────────────────────────────────────────────
def send_to_esp32(data: bytes, port: str, baudrate: int = 921600,
                  chunk_size: int = 256, delay_s: float = 0.003):
    try:
        import serial
    except ImportError:
        print("[ERR] 필요 패키지 없음: pip install pyserial")
        sys.exit(1)

    if data[:4] != MAGIC:
        print("[ERR] VIB1 헤더 없음")
        sys.exit(1)

    # 헤더 파싱해서 정보 출력
    _, ver, fps, n_frames, ch = struct.unpack_from("<4sBHIB", data, 0)
    print(f"\n[SEND] 포트: {port}  baudrate: {baudrate}")
    print(f"[SEND] fps={fps}  frames={n_frames}  channels={ch}  "
          f"재생시간={n_frames/fps:.1f}s")
    print(f"[SEND] 파일 크기: {len(data)} bytes")

    with serial.Serial(port, baudrate=baudrate, timeout=0.2, write_timeout=5) as ser:
        print("[SEND] 포트 열림 - ESP32 대기 중 (2초)...")
        time.sleep(2.0)
        ser.reset_input_buffer()
        ser.reset_output_buffer()

        total = len(data)
        sent  = 0

        print("[SEND] 전송 시작")
        while sent < total:
            end = min(sent + chunk_size, total)
            n   = ser.write(data[sent:end])
            ser.flush()
            sent += n

            pct = sent / total * 100
            if pct % 10 < (chunk_size / total * 100):
                print(f"[SEND] {sent}/{total} bytes ({pct:.0f}%)")

            time.sleep(delay_s)

        print("[SEND] 전송 완료")
        print("[SEND] ESP32 로그 수신 중 (15초)...\n")

        end_time = time.time() + 15
        while time.time() < end_time:
            if ser.in_waiting:
                msg = ser.read(ser.in_waiting).decode("utf-8", errors="ignore")
                print(msg, end="", flush=True)
            time.sleep(0.05)

    print("\n[DONE] 완료")


# ── 메인 ────────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(
        description="MP3/WAV → L/R 진동 패턴 변환 + ESP32 전송 (2ch)"
    )
    parser.add_argument("input",
                        help="입력 파일 (.mp3/.wav 또는 --send-only 시 .bin)")
    parser.add_argument("--out",       default=None,
                        help="출력 bin 파일 경로 (기본: 입력파일명.bin)")
    parser.add_argument("--fps",       type=int, default=50,
                        help="프레임 레이트 Hz (기본: 50)")
    parser.add_argument("--port",      default=None,
                        help="시리얼 포트 (예: COM3 / /dev/ttyUSB0)")
    parser.add_argument("--baud",      type=int, default=921600,
                        help="baudrate (기본: 921600)")
    parser.add_argument("--send-only", action="store_true",
                        help="변환 없이 기존 bin 파일만 전송")
    args = parser.parse_args()

    in_path = Path(args.input)

    # ── send-only 모드 ───────────────────────────────────────────────
    if args.send_only:
        if not in_path.exists():
            print(f"[ERR] 파일 없음: {in_path}")
            sys.exit(1)
        if not args.port:
            print("[ERR] --port 필요")
            sys.exit(1)
        data = in_path.read_bytes()
        send_to_esp32(data, args.port, args.baud)
        return

    # ── 변환 모드 ────────────────────────────────────────────────────
    if in_path.suffix.lower() not in SUPPORTED_AUDIO:
        print(f"[ERR] 지원 형식: {SUPPORTED_AUDIO}")
        sys.exit(1)

    out_path = args.out or str(in_path.with_suffix(".bin"))

    print(f"\n{'='*50}")
    print(f"  입력  : {in_path}")
    print(f"  출력  : {out_path}")
    print(f"  fps   : {args.fps} Hz")
    print(f"  채널  : {CHANNELS} (L/R 스테레오)")
    print(f"  전송  : {args.port or '없음 (저장만)'}")
    print(f"{'='*50}\n")

    int_l, int_r = audio_to_intensity_stereo(str(in_path), args.fps)
    data         = save_bin(int_l, int_r, out_path, args.fps)

    if args.port:
        send_to_esp32(data, args.port, args.baud)
    else:
        print("\n[INFO] --port 없음 → bin 저장만 완료")
        print(f"[INFO] 전송하려면: python audio_to_esp32.py {out_path} --port COM3 --send-only")


if __name__ == "__main__":
    main()
