import argparse
import struct
from pathlib import Path

import numpy as np
import librosa

MAGIC = b"VIB1"

def audio_to_intensity(path, fps=50):
    y, sr = librosa.load(path, mono=True)
    hop = int(sr / fps)

    # 1. RMS → dB (최대값 기준)
    rms = librosa.feature.rms(y=y, hop_length=hop)[0]
    db  = librosa.amplitude_to_db(rms, ref=np.max)
    db  = np.clip(db, -60, 0)

    # 2. 0~1 정규화
    norm = (db + 60) / 60

    # 3. tanh soft-clipping (약한 소리 강조, 강한 소리 압축)
    TANH_SCALE = 2.5
    shaped = np.tanh(TANH_SCALE * norm) / np.tanh(TANH_SCALE)

    # 4. 온셋 감지 → 강도 boost
    onset_frames = librosa.onset.onset_detect(y=y, sr=sr, hop_length=hop)
    onset_mask   = np.zeros(len(shaped), dtype=bool)
    onset_mask[onset_frames[onset_frames < len(shaped)]] = True
    shaped[onset_mask] = np.minimum(shaped[onset_mask] * 1.4, 1.0)

    # 5. 엔벨로프 스무딩 (급격한 변화 완화)
    from scipy.ndimage import uniform_filter1d
    shaped = uniform_filter1d(shaped, size=3)

    # 6. 0~255 변환 (무음 구간 = 0 유지)
    intensity = (shaped * 255).astype(np.uint8)
    silence_mask = (db <= -58)
    intensity[silence_mask] = 0

    return intensity


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("input_audio")
    parser.add_argument("--out", default="haptic_test.bin")
    parser.add_argument("--fps", type=int, default=50)
    args = parser.parse_args()

    intensity = audio_to_intensity(args.input_audio, args.fps)

    print(f"frames   : {len(intensity)}")
    print(f"min/max  : {intensity.min()} / {intensity.max()}")
    print(f"평균강도 : {intensity[intensity>0].mean():.1f}")

    header = struct.pack("<4sBHIB", MAGIC, 1, args.fps, len(intensity), 1)
    data   = header + intensity.tobytes()
    Path(args.out).write_bytes(data)
    print(f"저장     : {args.out} ({len(data)} bytes)")


if __name__ == "__main__":
    main()
    