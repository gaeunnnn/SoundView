// 진동 프레임 디버깅 유틸리티 — hex 출력, 체크섬 검증, 오프셋 상세 출력

import type { FrameDebugInfo, VibrationFrameInput } from "../types/vibration";
import { FRAME_SIZE, verifyFrameChecksum } from "./vibrationChecksum";
import { buildVibrationFrame } from "./vibrationFrame";

/**
 * Uint8Array 16바이트 -> "AA 55 01 ..." 형태의 hex 문자열
 */
export function frameToHex(frame: Uint8Array): string {
  return Array.from(frame)
    .map((b) => b.toString(16).toUpperCase().padStart(2, "0"))
    .join(" ");
}

/**
 * 단일 프레임의 모든 오프셋 값과 체크섬 검증 결과를 반환
 */
export function inspectFrame(frame: Uint8Array, frameIndex = 0): FrameDebugInfo {
  if (frame.length !== FRAME_SIZE) {
    throw new Error(`frame must be ${FRAME_SIZE} bytes, got ${frame.length}`);
  }

  const view = new DataView(frame.buffer, frame.byteOffset, frame.byteLength);
  const { stored, calculated, match } = verifyFrameChecksum(frame);

  return {
    frameIndex,
    hex: frameToHex(frame),
    storedChecksum: stored,
    calculatedChecksum: calculated,
    checksumMatch: match,
    fields: {
      header: `0x${frame[0].toString(16).toUpperCase().padStart(2, "0")} 0x${frame[1].toString(16).toUpperCase().padStart(2, "0")}`,
      seq: frame[2],
      timestampMs: view.getUint32(3, true),
      soundClass: frame[7],
      vibType: frame[8],
      frequency: frame[9],
      intensityL: frame[10],
      intensityR: frame[11],
      durationMs: view.getUint16(12, true),
    },
  };
}

/**
 * 여러 프레임 바이너리(Uint8Array)를 줄 단위 hex 문자열로 변환
 * 각 줄 = "Frame 00: AA 55 ..."
 */
export function binaryToHexLines(binary: Uint8Array): string[] {
  const lines: string[] = [];
  const count = binary.length / FRAME_SIZE;
  for (let i = 0; i < count; i++) {
    const frame = binary.slice(i * FRAME_SIZE, (i + 1) * FRAME_SIZE);
    const idx = String(i).padStart(2, "0");
    lines.push(`Frame ${idx}: ${frameToHex(frame)}`);
  }
  return lines;
}

/**
 * 여러 VibrationFrameInput을 빌드하고 각 프레임의 FrameDebugInfo 배열 반환
 */
export function debugFrames(inputs: VibrationFrameInput[]): FrameDebugInfo[] {
  return inputs.map((input, i) => {
    const frame = buildVibrationFrame(input);
    return inspectFrame(frame, i);
  });
}

/**
 * FrameDebugInfo를 사람이 읽기 쉬운 문자열로 포맷
 */
export function formatDebugInfo(info: FrameDebugInfo): string {
  const csStatus = info.checksumMatch ? "OK" : `MISMATCH (stored=0x${info.storedChecksum.toString(16).toUpperCase().padStart(4,"0")}, calc=0x${info.calculatedChecksum.toString(16).toUpperCase().padStart(4,"0")})`;
  return [
    `--- Frame #${info.frameIndex} ---`,
    `  HEX      : ${info.hex}`,
    `  header   : ${info.fields.header}       [0-1]`,
    `  seq      : ${info.fields.seq}              [2]`,
    `  timestamp: ${info.fields.timestampMs} ms       [3-6] uint32 LE`,
    `  soundCls : ${info.fields.soundClass}              [7]`,
    `  vibType  : ${info.fields.vibType}              [8]`,
    `  frequency: ${info.fields.frequency}              [9]`,
    `  intL     : ${info.fields.intensityL}              [10]`,
    `  intR     : ${info.fields.intensityR}              [11]`,
    `  duration : ${info.fields.durationMs} ms       [12-13] uint16 LE`,
    `  checksum : ${csStatus}  [14-15] uint16 LE`,
  ].join("\n");
}

/**
 * 이미 생성된 바이너리(Uint8Array)에서 각 프레임 체크섬을 일괄 재검증
 * 불일치 프레임이 있으면 콘솔 경고 출력
 */
export function verifyAllChecksums(binary: Uint8Array): { frameIndex: number; match: boolean }[] {
  const results: { frameIndex: number; match: boolean }[] = [];
  const count = binary.length / FRAME_SIZE;
  for (let i = 0; i < count; i++) {
    const frame = binary.slice(i * FRAME_SIZE, (i + 1) * FRAME_SIZE);
    const { match } = verifyFrameChecksum(frame);
    if (!match) {
      const { stored, calculated } = verifyFrameChecksum(frame);
      console.warn(
        `[VIB] Frame #${i} checksum MISMATCH: stored=0x${stored.toString(16).toUpperCase().padStart(4,"0")}, calculated=0x${calculated.toString(16).toUpperCase().padStart(4,"0")}`
      );
    }
    results.push({ frameIndex: i, match });
  }
  return results;
}

/**
 * 단일 프레임의 checksum 계산 과정을 상세 출력 (디버깅용)
 */
export function explainChecksum(frame: Uint8Array): string {
  const bytes = Array.from(frame.slice(0, 14));
  const hex = bytes.map((b) => `0x${b.toString(16).toUpperCase().padStart(2, "0")}`).join(" + ");
  const sum = bytes.reduce((a, b) => a + b, 0);
  const masked = sum & 0xFFFF;
  const view = new DataView(frame.buffer, frame.byteOffset, frame.byteLength);
  const stored = view.getUint16(14, true);
  return [
    `sum([0..13]) = ${hex}`,
    `           = ${sum} (0x${sum.toString(16).toUpperCase()})`,
    `& 0xFFFF   = ${masked} (0x${masked.toString(16).toUpperCase().padStart(4, "0")})`,
    `stored[14-15] = 0x${stored.toString(16).toUpperCase().padStart(4, "0")} (${stored === masked ? "match" : "MISMATCH"})`,
  ].join("\n");
}
