// ESP32 진동 프레임 관련 타입 정의

export type VibrationFrameInput = {
  seq: number;          // uint8  0~255
  timestampMs: number;  // uint32 0~4294967295
  soundClass: number;   // uint8  0~255
  vibType: number;      // uint8  0~255
  frequency: number;    // uint8  0~255
  intensityL: number;   // uint8  0~255
  intensityR: number;   // uint8  0~255
  durationMs: number;   // uint16 0~65535
};

export type FrameValidationError = {
  field: keyof VibrationFrameInput;
  value: number;
  message: string;
};

export type FrameValidationResult =
  | { ok: true }
  | { ok: false; errors: FrameValidationError[] };

export type FrameDebugInfo = {
  frameIndex: number;
  hex: string;
  storedChecksum: number;
  calculatedChecksum: number;
  checksumMatch: boolean;
  fields: {
    header: string;
    seq: number;
    timestampMs: number;
    soundClass: number;
    vibType: number;
    frequency: number;
    intensityL: number;
    intensityR: number;
    durationMs: number;
  };
};
