"""
audio_to_esp32.py
MP3/WAV → 진동 패턴 변환 → ESP32 시리얼 전송 통합 스크립트

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

MAGIC = b"VIB1"
SUPPORTED_AUDIO = {".mp3", ".wav", ".flac", ".ogg", ".m4a"}


# ── 오디오 → 진동 강도 변환 ──────────────────────────────────────────
def audio_to_intensity(path: str, fps: int = 50) -> np.ndarray:
    try:
        import librosa
        from scipy.ndimage import uniform_filter1d
    except ImportError:
        print("[ERR] 필요 패키지 없음: pip install librosa scipy")
        sys.exit(1)

    print(f"[CONV] 로드 중: {path}")
    y, sr = librosa.load(path, mono=True)
    hop   = int(sr / fps)

    # 1. RMS → dB (최대값 기준)
    rms = librosa.feature.rms(y=y, hop_length=hop)[0]
    db  = librosa.amplitude_to_db(rms, ref=np.max)
    db  = np.clip(db, -60, 0)

    # 2. 0~1 정규화
    norm = (db + 60) / 60

    # 3. tanh soft-clipping
    TANH_SCALE = 2.5
    shaped = np.tanh(TANH_SCALE * norm) / np.tanh(TANH_SCALE)

    # 4. 온셋 감지 → 강도 boost
    onset_frames = librosa.onset.onset_detect(y=y, sr=sr, hop_length=hop)
    onset_mask   = np.zeros(len(shaped), dtype=bool)
    valid_onsets = onset_frames[onset_frames < len(shaped)]
    onset_mask[valid_onsets] = True
    shaped[onset_mask] = np.minimum(shaped[onset_mask] * 1.4, 1.0)

    # 5. 엔벨로프 스무딩
    shaped = uniform_filter1d(shaped, size=3)

    # 6. 0~255 변환 + 무음 구간 = 0
    intensity = (shaped * 255).astype(np.uint8)
    intensity[db <= -58] = 0

    duration_s = len(intensity) / fps
    print(f"[CONV] 완료: {len(intensity)}프레임 ({duration_s:.1f}초)")
    print(f"[CONV] 강도: min={intensity.min()}  max={intensity.max()}  "
          f"평균={intensity[intensity > 0].mean():.1f}")

    return intensity


# ── bin 파일 저장 ────────────────────────────────────────────────────
def save_bin(intensity: np.ndarray, out_path: str, fps: int):
    header = struct.pack("<4sBHIB", MAGIC, 1, fps, len(intensity), 1)
    data   = header + intensity.tobytes()
    Path(out_path).write_bytes(data)
    print(f"[SAVE] {out_path} ({len(data)} bytes)")
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
        print("[ERR] VIB1 헤더 없음 - 올바른 bin 파일인지 확인")
        sys.exit(1)

    print(f"\n[SEND] 포트: {port}  baudrate: {baudrate}")
    print(f"[SEND] 파일 크기: {len(data)} bytes")
    print(f"[SEND] 헤더: {data[:16].hex()}")

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

            # 진행률 표시 (10% 단위)
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
        description="MP3/WAV → 진동 패턴 변환 + ESP32 전송"
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
    print(f"  전송  : {args.port or '없음 (저장만)'}")
    print(f"{'='*50}\n")

    intensity = audio_to_intensity(str(in_path), args.fps)
    data      = save_bin(intensity, out_path, args.fps)

    if args.port:
        send_to_esp32(data, args.port, args.baud)
    else:
        print("\n[INFO] --port 없음 → bin 저장만 완료")
        print(f"[INFO] 전송하려면: python audio_to_esp32.py {out_path} --port COM3 --send-only")


if __name__ == "__main__":
    main()