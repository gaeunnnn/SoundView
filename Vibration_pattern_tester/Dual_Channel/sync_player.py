"""
sync_player.py  v2
오디오 재생 + 진동 시리얼 스트리밍 동시 수행 (싱크 보정 포함)

싱크 전략:
  1. 오디오 먼저 시작 → 디바이스 레이턴시 흡수 후 시리얼 시작
  2. busy-wait + drift 보정으로 누적 지연 방지
  3. --audio-lead 옵션으로 미세 조정 가능

사용법:
  python sync_player.py alarm.mp3 --port COM3
  python sync_player.py alarm.mp3 --port COM3 --audio-lead 80
  python sync_player.py alarm.bin --port COM3 --audio alarm.mp3
  python sync_player.py alarm.bin --port COM3 --no-audio
"""

import argparse
import struct
import sys
import time
import threading
from pathlib import Path

import numpy as np

MAGIC = b"VIB1"
SUPPORTED_AUDIO = {".mp3", ".wav", ".flac", ".ogg", ".m4a"}


# ═══════════════════════════════════════════════════════════════════════
# 싱크 로거
# ═══════════════════════════════════════════════════════════════════════
class SyncLogger:
    def __init__(self):
        self.t0 = None
        self.audio_start_ms = None
        self.serial_start_ms = None
        self.frame_log = []       # (frame_idx, actual_ms, expected_ms)
        self.esp_log = []         # (ms, line)

    def set_origin(self):
        self.t0 = time.perf_counter()

    def ms(self):
        return (time.perf_counter() - self.t0) * 1000 if self.t0 else 0

    def report(self, fps, n_frames):
        lines = []
        lines.append("")
        lines.append("=" * 60)
        lines.append("  SYNC REPORT")
        lines.append("=" * 60)

        if self.audio_start_ms is not None and self.serial_start_ms is not None:
            gap = self.serial_start_ms - self.audio_start_ms
            lines.append(f"  Audio start  : {self.audio_start_ms:.1f} ms")
            lines.append(f"  Serial start : {self.serial_start_ms:.1f} ms")
            lines.append(f"  Audio lead   : {gap:.1f} ms")
        lines.append("")

        if len(self.frame_log) > 1:
            drifts = [(idx, actual - expected)
                      for idx, actual, expected in self.frame_log]
            drift_vals = [d for _, d in drifts]
            lines.append(f"  Frame target : {1000/fps:.1f} ms")
            lines.append(f"  Max drift    : {max(abs(d) for d in drift_vals):.2f} ms")
            lines.append(f"  End drift    : {drift_vals[-1]:+.1f} ms")
            lines.append(f"  Frames       : {len(self.frame_log)}/{n_frames}")
            lines.append("")
            lines.append(f"  {'Frame':>7s}  {'Drift':>8s}")
            for idx, drift in drifts:
                if idx % (fps * 10) == 0:  # 10초마다
                    lines.append(f"  {idx:7d}  {drift:+8.1f} ms")
            # 마지막 프레임
            if drifts[-1][0] % (fps * 10) != 0:
                lines.append(f"  {drifts[-1][0]:7d}  {drifts[-1][1]:+8.1f} ms")

        if self.esp_log:
            lines.append("")
            lines.append("  ESP32 log (last 15 lines):")
            for t_ms, line in self.esp_log[-15:]:
                lines.append(f"    [{t_ms:8.1f} ms] {line}")

        lines.append("=" * 60)
        return "\n".join(lines)


# ═══════════════════════════════════════════════════════════════════════
# 오디오 재생 스레드
# ═══════════════════════════════════════════════════════════════════════
def play_audio_thread(audio_path, start_event, logger):
    try:
        import sounddevice as sd
        import soundfile as sf
    except ImportError:
        print("[WARN] pip install sounddevice soundfile")
        print("[WARN] 오디오 재생 건너뜀")
        start_event.wait()
        return

    print(f"[AUDIO] 로드: {audio_path}")
    data, sr = sf.read(audio_path)
    print(f"[AUDIO] sr={sr}  {len(data)/sr:.2f}s  준비 완료")

    start_event.wait()
    logger.audio_start_ms = logger.ms()
    print(f"[AUDIO] ▶ 재생 시작 ({logger.audio_start_ms:.1f} ms)")

    sd.play(data, sr)
    sd.wait()
    print(f"[AUDIO] ■ 재생 완료 ({logger.ms():.1f} ms)")


# ═══════════════════════════════════════════════════════════════════════
# ESP32 로그 수신 스레드
# ═══════════════════════════════════════════════════════════════════════
def esp_log_thread(ser, logger, stop_event):
    buf = ""
    while not stop_event.is_set():
        try:
            if ser.in_waiting:
                chunk = ser.read(ser.in_waiting).decode("utf-8", errors="ignore")
                buf += chunk
                while "\n" in buf:
                    line, buf = buf.split("\n", 1)
                    line = line.strip()
                    if line:
                        logger.esp_log.append((logger.ms(), line))
                        print(f"  [ESP] {line}")
        except Exception:
            pass
        time.sleep(0.005)


# ═══════════════════════════════════════════════════════════════════════
# 메인 싱크 재생기
# ═══════════════════════════════════════════════════════════════════════
def sync_play(bin_data, port, baudrate, audio_path=None,
              no_audio=False, audio_lead_ms=100, log_path=None):
    try:
        import serial
    except ImportError:
        print("[ERR] pip install pyserial"); sys.exit(1)

    if bin_data[:4] != MAGIC:
        print("[ERR] VIB1 헤더 없음"); sys.exit(1)

    _, ver, fps, n_frames, channels = struct.unpack_from("<4sBHIB", bin_data, 0)
    frame_interval = 1.0 / fps
    header = bin_data[:12]
    payload = bin_data[12:]

    print(f"\n{'='*55}")
    print(f"  sync_player v2")
    print(f"  fps={fps}  frames={n_frames}  ch={channels}")
    print(f"  duration: {n_frames/fps:.1f}s")
    print(f"  audio: {audio_path or 'none'}")
    print(f"  audio_lead: {audio_lead_ms}ms")
    print(f"{'='*55}\n")

    logger = SyncLogger()

    with serial.Serial(port, baudrate=baudrate, timeout=0.1, write_timeout=5) as ser:
        print("[SERIAL] 포트 열림 — ESP32 대기 (2초)")
        time.sleep(2.0)
        ser.reset_input_buffer()
        ser.reset_output_buffer()

        # ESP32 로그 수신 시작
        stop_log = threading.Event()
        log_t = threading.Thread(target=esp_log_thread,
                                 args=(ser, logger, stop_log), daemon=True)
        log_t.start()

        # 오디오 스레드 준비 (헤더는 아직 안 보냄)
        start_event = threading.Event()
        audio_t = None
        if audio_path and not no_audio:
            audio_t = threading.Thread(
                target=play_audio_thread,
                args=(audio_path, start_event, logger), daemon=True
            )
            audio_t.start()
            time.sleep(0.1)

        # ── 카운트다운 ───────────────────────────────────────────────
        logger.set_origin()
        print("[SYNC] 3... ", end="", flush=True); time.sleep(0.5)
        print("2... ", end="", flush=True); time.sleep(0.5)
        print("1... ", end="", flush=True); time.sleep(0.5)
        print("GO!")

        # ── 핵심: 오디오 먼저 → 리드타임 → 헤더+프레임 ────────────────
        start_event.set()  # 오디오 재생 시작

        if audio_lead_ms > 0 and audio_path and not no_audio:
            lead_sec = audio_lead_ms / 1000.0
            lead_start = time.perf_counter()
            while (time.perf_counter() - lead_start) < lead_sec:
                pass
            print(f"[SYNC] 오디오 리드 {audio_lead_ms}ms 대기 완료")

        # 헤더 전송 (스트리밍 직전에 보내야 ESP32 타임아웃 방지)
        print("[SERIAL] VIB1 헤더 전송")
        ser.write(header)
        ser.flush()

        logger.serial_start_ms = logger.ms()
        print(f"[SERIAL] ▶ 프레임 스트리밍 시작 ({logger.serial_start_ms:.1f} ms)")

        # ── 프레임 실시간 전송 (drift 보정) ───────────────────────────
        bytes_per_frame = channels
        t_origin = time.perf_counter()  # 시리얼 기준 시각

        for fi in range(n_frames):
            # 이 프레임의 절대 목표 시각 (누적 오차 방지)
            target_time = t_origin + fi * frame_interval

            # busy-wait (sleep보다 정밀)
            while time.perf_counter() < target_time:
                pass

            # 프레임 전송
            offset = fi * bytes_per_frame
            if offset + bytes_per_frame <= len(payload):
                ser.write(payload[offset:offset + bytes_per_frame])
                # flush는 매 프레임 하지 않음 (OS 버퍼가 처리)

            # 로그 (50프레임 = 1초마다)
            if fi % 50 == 0:
                actual_ms = (time.perf_counter() - t_origin) * 1000
                expected_ms = fi * frame_interval * 1000
                logger.frame_log.append((fi, actual_ms, expected_ms))

                if channels >= 2 and offset + 1 < len(payload):
                    l_val = payload[offset]
                    r_val = payload[offset + 1]
                    drift = actual_ms - expected_ms
                    print(f"  [TX] {fi:5d}/{n_frames}  "
                          f"L={l_val:3d} R={r_val:3d}  "
                          f"drift={drift:+.1f}ms")

        # 마지막 프레임 기록
        final_ms = (time.perf_counter() - t_origin) * 1000
        final_expected = n_frames * frame_interval * 1000
        logger.frame_log.append((n_frames, final_ms, final_expected))

        ser.flush()
        print(f"\n[SERIAL] ■ 전송 완료 ({n_frames}f, "
              f"drift={final_ms - final_expected:+.1f}ms)")

        # ESP32 잔여 로그
        print("[LOG] ESP32 로그 수신 (3초)...")
        time.sleep(3.0)
        stop_log.set()

        if audio_t:
            audio_t.join(timeout=3)

    # ── 리포트 ────────────────────────────────────────────────────────
    report = logger.report(fps, n_frames)
    print(report)

    save_path = log_path or "sync_report.txt"
    Path(save_path).write_text(report, encoding="utf-8")
    print(f"[LOG] 저장: {save_path}")


# ═══════════════════════════════════════════════════════════════════════
# 메인
# ═══════════════════════════════════════════════════════════════════════
def main():
    p = argparse.ArgumentParser(description="audio+haptic sync player v2")
    p.add_argument("input")
    p.add_argument("--port", required=True)
    p.add_argument("--baud", type=int, default=921600)
    p.add_argument("--fps", type=int, default=50)
    p.add_argument("--audio", default=None,
                   help="bin 입력 시 별도 오디오 파일")
    p.add_argument("--no-audio", action="store_true")
    p.add_argument("--audio-lead", type=int, default=100,
                   help="오디오 선행 시간 ms (기본: 100)")
    p.add_argument("--log", default=None)
    a = p.parse_args()
    inp = Path(a.input)

    if inp.suffix.lower() == ".bin":
        bin_data = inp.read_bytes()
        audio_path = a.audio
    elif inp.suffix.lower() in SUPPORTED_AUDIO:
        print("[CONV] 오디오 → bin 변환 (v3)")
        try:
            sys.path.insert(0, str(Path(__file__).parent))
            from audio_to_esp32_v3 import audio_to_intensity_stereo, save_bin
        except ImportError:
            print("[ERR] audio_to_esp32_v3.py 필요"); sys.exit(1)
        int_l, int_r, _, _ = audio_to_intensity_stereo(str(inp), a.fps)
        bin_path = str(inp.with_suffix(".bin"))
        bin_data = save_bin(int_l, int_r, bin_path, a.fps)
        audio_path = str(inp)
    else:
        print(f"[ERR] 지원: .bin 또는 {SUPPORTED_AUDIO}"); sys.exit(1)

    sync_play(bin_data, a.port, a.baud,
              audio_path=audio_path,
              no_audio=a.no_audio,
              audio_lead_ms=a.audio_lead,
              log_path=a.log)


if __name__ == "__main__":
    main()