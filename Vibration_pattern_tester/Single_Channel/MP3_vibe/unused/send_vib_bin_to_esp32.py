import argparse
import time
from pathlib import Path
import sys

import serial


def send_file(path, port, baudrate=921600, chunk_size=256, delay_s=0.003):
    data = Path(path).read_bytes()

    print("[INFO] start")
    print("[INFO] cwd        :", Path.cwd())
    print("[INFO] file path   :", Path(path).resolve())
    print("[INFO] port        :", port)
    print("[INFO] baudrate    :", baudrate)
    print("[INFO] file size   :", len(data))
    print("[INFO] head bytes  :", data[:16])
    print("[INFO] head hex    :", data[:16].hex())

    if data[:4] != b"VIB1":
        print("[ERR] invalid VIB1 file")
        sys.exit(1)

    with serial.Serial(port, baudrate=baudrate, timeout=0.2, write_timeout=5) as ser:
        print("[INFO] serial opened")
        time.sleep(2.0)

        ser.reset_input_buffer()
        ser.reset_output_buffer()

        total = len(data)
        sent = 0

        while sent < total:
            end = min(sent + chunk_size, total)
            n = ser.write(data[sent:end])
            ser.flush()
            sent += n
            print(f"[SEND] {sent}/{total} bytes")
            time.sleep(delay_s)

        print("[DONE] file send complete")
        print("[INFO] reading ESP logs for 15 sec...")

        end_time = time.time() + 15
        while time.time() < end_time:
            if ser.in_waiting:
                msg = ser.read(ser.in_waiting).decode("utf-8", errors="ignore")
                print(msg, end="")
            time.sleep(0.05)

        print("\n[INFO] log capture done")


def main():
    p = argparse.ArgumentParser()
    p.add_argument("bin_file")
    p.add_argument("--port", required=True)
    p.add_argument("--baud", type=int, default=921600)
    args = p.parse_args()

    send_file(args.bin_file, args.port, args.baud)


if __name__ == "__main__":
    main()
    
    # python send_vib_bin_to_esp32.py alarm_vib.bin --port COM3