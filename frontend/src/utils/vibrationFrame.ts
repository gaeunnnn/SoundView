// 16바이트 고정 프레임 직렬화 및 바이너리 생성 유틸리티

import type { VibrationFrameInput } from "../types/vibration";
import {
  FRAME_SIZE,
  HEADER_0,
  HEADER_1,
  calculateFrameChecksum,
  validateFrameInput,
} from "./vibrationChecksum";

/**
 * 단일 VibrationFrameInput -> 정확히 16바이트 Uint8Array
 *
 * 바이트 레이아웃:
 *   [0]     0xAA                      header
 *   [1]     0x55                      header
 *   [2]     seq          uint8
 *   [3-6]   timestampMs  uint32 LE
 *   [7]     soundClass   uint8
 *   [8]     vibType      uint8
 *   [9]     frequency    uint8
 *   [10]    intensityL   uint8
 *   [11]    intensityR   uint8
 *   [12-13] durationMs   uint16 LE
 *   [14-15] checksum     uint16 LE    sum(frame[0..13]) & 0xFFFF
 */
export function buildVibrationFrame(input: VibrationFrameInput): Uint8Array {
  const result = validateFrameInput(input);
  if (!result.ok) {
    const msg = result.errors.map((e) => e.message).join("; ");
    throw new Error(`VibrationFrame validation failed: ${msg}`);
  }

  const buf = new ArrayBuffer(FRAME_SIZE);
  const view = new DataView(buf);
  const u8 = new Uint8Array(buf);

  // [0-1] header
  u8[0] = HEADER_0; // 0xAA
  u8[1] = HEADER_1; // 0x55

  // [2] seq
  u8[2] = input.seq;

  // [3-6] timestampMs uint32 little-endian
  view.setUint32(3, input.timestampMs, true);

  // [7] soundClass
  u8[7] = input.soundClass;

  // [8] vibType
  u8[8] = input.vibType;

  // [9] frequency
  u8[9] = input.frequency;

  // [10] intensityL
  u8[10] = input.intensityL;

  // [11] intensityR
  u8[11] = input.intensityR;

  // [12-13] durationMs uint16 little-endian
  view.setUint16(12, input.durationMs, true);

  // [14-15] checksum uint16 little-endian
  // 반드시 [0]~[13]까지만 합산 — [14][15]는 아직 0이므로 합산해도 무관하나,
  // ESP 코드와 동일한 범위를 명시적으로 보장하기 위해 calculateFrameChecksum 사용
  const checksum = calculateFrameChecksum(u8);
  view.setUint16(14, checksum, true);

  return u8;
}

/**
 * 여러 프레임 -> 16*N 바이트 Uint8Array (프레임 순서대로 이어붙임)
 */
export function buildVibrationBinary(frames: VibrationFrameInput[]): Uint8Array {
  if (frames.length === 0) {
    return new Uint8Array(0);
  }
  const out = new Uint8Array(frames.length * FRAME_SIZE);
  frames.forEach((f, i) => {
    const frame = buildVibrationFrame(f);
    out.set(frame, i * FRAME_SIZE);
  });
  return out;
}

/**
 * 바이너리를 <a> 태그로 다운로드
 */
export function downloadVibrationBinary(
  frames: VibrationFrameInput[],
  fileName = "vibration.bin"
): void {
  const binary = buildVibrationBinary(frames);
  const blob = new Blob([binary.buffer as ArrayBuffer], { type: "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

export { FRAME_SIZE };
