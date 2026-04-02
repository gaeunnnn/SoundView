import { useState, useCallback } from "react";
import { useEsp32WebSocket } from "../../hooks/useEsp32WebSocket";

type Status = "connecting" | "connected" | "disconnected" | "error";

// 상태별 표시 색상
const STATUS_COLOR: Record<Status, string> = {
  connecting:   "orange",
  connected:    "green",
  disconnected: "gray",
  error:        "red",
};

export default function Esp32WebSocketClient() {
  const [status, setStatus] = useState<Status>("disconnected");

  // 메시지 수신 처리 (이후 진동 chunk 파싱 로직을 여기에 추가)
  const handleMessage = useCallback((data: ArrayBuffer | string) => {
    if (data instanceof ArrayBuffer) {
      const view = new Uint8Array(data);
      console.log("[App] 바이너리 수신 (bytes):", view.length);
    } else {
      console.log("[App] 텍스트 수신:", data);
    }
  }, []);

  const { connect, disconnect, send } = useEsp32WebSocket(setStatus, handleMessage);

  // 테스트용 바이너리 전송: [0x01, 0x02, 0x03, 0x04]
  const handleSendTestBinary = () => {
    const testData = new Uint8Array([0x01, 0x02, 0x03, 0x04]);
    send(testData);
  };

  const isConnected = status === "connected";
  const isConnecting = status === "connecting";

  return (
    <div style={{ padding: "24px", fontFamily: "monospace" }}>
      <h2>ESP32 WebSocket 클라이언트</h2>

      {/* 현재 연결 상태 표시 */}
      <p>
        상태:{" "}
        <strong style={{ color: STATUS_COLOR[status] ?? "black" }}>
          {status}
        </strong>
      </p>

      {/* 버튼: 상태에 따라 활성/비활성 */}
      <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
        <button
          onClick={connect}
          disabled={isConnected || isConnecting}
        >
          connect
        </button>

        <button
          onClick={disconnect}
          disabled={!isConnected && !isConnecting}
        >
          disconnect
        </button>

        <button
          onClick={handleSendTestBinary}
          disabled={!isConnected}
        >
          send test binary
        </button>
      </div>
    </div>
  );
}
