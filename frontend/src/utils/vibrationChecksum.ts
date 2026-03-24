// 16바이트 프레임의 체크섬 계산 및 검증 유틸리티

import type { FrameValidationError, FrameValidationResult, VibrationFrameInput } from "../types/vibration";

export const FRAME_SIZE = 16;
export const HEADER_0 = 0xAA;
export const HEADER_1 = 0x55;

/**
 * frame[0]~frame[13] 합산 후 0xFFFF 마스킹
 * 체크섬 필드(frame[14], frame[15])는 절대 포함하지 않음
 */
export function calculateFrameChecksum(frame: Uint8Array): number {
  if (frame.length < FRAME_SIZE) {
    throw new Error(`frame must be at least ${FRAME_SIZE} bytes, got ${frame.length}`);
  }
  let sum = 0;
  for (let i = 0; i <= 13; i++) {
    sum += frame[i];
  }
  return sum & 0xFFFF;
}

/**
 * 저장된 체크섬([14-15] LE)과 재계산 결과가 일치하는지 검증
 */
export function verifyFrameChecksum(frame: Uint8Array): {
  stored: number;
  calculated: number;
  match: boolean;
} {
  const view = new DataView(frame.buffer, frame.byteOffset, frame.byteLength);
  const stored = view.getUint16(14, true); // little-endian
  const calculated = calculateFrameChecksum(frame);
  return { stored, calculated, match: stored === calculated };
}

/**
 * 입력값 범위 검증
 */
export function validateFrameInput(input: VibrationFrameInput): FrameValidationResult {
  const errors: FrameValidationError[] = [];

  const checks: Array<[keyof VibrationFrameInput, number, number]> = [
    ["seq",        0, 255],
    ["timestampMs", 0, 4294967295],
    ["soundClass", 0, 255],
    ["vibType",    0, 255],
    ["frequency",  0, 255],
    ["intensityL", 0, 255],
    ["intensityR", 0, 255],
    ["durationMs", 0, 65535],
  ];

  for (const [field, min, max] of checks) {
    const val = input[field];
    if (!Number.isInteger(val) || val < min || val > max) {
      errors.push({
        field,
        value: val,
        message: `${field} must be an integer in [${min}, ${max}], got ${val}`,
      });
    }
  }

  return errors.length === 0 ? { ok: true } : { ok: false, errors };
}
