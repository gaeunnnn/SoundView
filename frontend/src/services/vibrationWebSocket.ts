// ESP32 WebSocket 서버로 진동 바이너리를 전송하는 서비스

import type { VibrationFrameInput } from "../types/vibration";
import { buildVibrationBinary } from "../utils/vibrationFrame";

const CONNECT_TIMEOUT_MS = 5000;
const SEND_FLUSH_INTERVAL_MS = 20;
const FLUSH_TIMEOUT_MS = 10000;

export type SendResult = {
  ok: boolean;
  bytesSent: number;
  ackMessages: string[];
  error?: string;
};


/**
 * ws.bufferedAmount가 0이 될 때까지 대기 (타임아웃 포함)
 */
function waitForFlush(ws: WebSocket, timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs;
    const check = () => {
      if (ws.bufferedAmount === 0) { resolve(); return; }
      if (Date.now() > deadline) { reject(new Error("WebSocket flush timeout")); return; }
      setTimeout(check, SEND_FLUSH_INTERVAL_MS);
    };
    check();
  });
}

/**
 * ESP32 WebSocket 서버(ws://<ip>:81)로 진동 바이너리 전송
 *
 * 순서:
 *   1. WebSocket 연결
 *   2. 바이너리 전송 (전체 한 번에)
 *   3. 버퍼 flush 대기
 *   4. "DONE" 텍스트 전송 (ESP가 totalBytes를 로깅하도록)
 *   5. JSON ack 수신 대기 (1초)
 *   6. 연결 종료
 */
export async function sendVibrationToESP32(
  wsUrl: string,
  frames: VibrationFrameInput[]
): Promise<SendResult> {
  const binary = buildVibrationBinary(frames);
  const ackMessages: string[] = [];

  return new Promise((resolve) => {
    let ws: WebSocket;

    const finish = (ok: boolean, error?: string) => {
      try { ws.close(); } catch { /* ignore */ }
      resolve({ ok, bytesSent: ok ? binary.length : 0, ackMessages, error });
    };

    try {
      ws = new WebSocket(wsUrl);
      ws.binaryType = "arraybuffer";
    } catch (e) {
      resolve({ ok: false, bytesSent: 0, ackMessages, error: String(e) });
      return;
    }

    const connectTimer = setTimeout(() => {
      finish(false, `Connect timeout after ${CONNECT_TIMEOUT_MS}ms`);
    }, CONNECT_TIMEOUT_MS);

    ws.onmessage = (event: MessageEvent) => {
      if (typeof event.data === "string") {
        ackMessages.push(event.data);
        console.log("[VIB WS] ack:", event.data);
      }
    };

    ws.onerror = () => {
      clearTimeout(connectTimer);
      finish(false, "WebSocket error");
    };

    ws.onclose = () => {
      // close 이벤트는 finish 호출 이후에도 발생할 수 있으므로 무시
    };

    ws.onopen = async () => {
      clearTimeout(connectTimer);
      try {
        // 바이너리 전송
        ws.send(binary.buffer);
        console.log("[VIB WS] sent binary:", binary.length, "bytes");

        // 버퍼 flush 대기
        await waitForFlush(ws, FLUSH_TIMEOUT_MS);

        // ESP의 수신 완료 처리를 위해 "DONE" 전송
        ws.send("DONE");
        console.log("[VIB WS] sent DONE");

        // ack 수신 대기 (1초)
        await new Promise<void>((r) => setTimeout(r, 1000));

        finish(true);
      } catch (e) {
        finish(false, String(e));
      }
    };
  });
}
