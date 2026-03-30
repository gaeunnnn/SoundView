// ESP32 WebSocket 연결 상태를 전역으로 관리하는 컨텍스트
import { createContext, useContext, useState, useCallback, useRef } from "react";
import { useEsp32WebSocket } from "../hooks/useEsp32WebSocket";

type EspStatus = "connecting" | "connected" | "disconnected" | "error";

type EspContextValue = {
  status: EspStatus;
  isConnected: boolean;
  connect: () => void;
  disconnect: () => void;
  send: (data: Uint8Array | ArrayBuffer) => void;
  // 데이터 전송 후 버퍼가 비워질 때까지 대기
  sendAndFlush: (data: Uint8Array | ArrayBuffer) => Promise<void>;
  toggle: () => void;
};

const EspContext = createContext<EspContextValue | null>(null);

export function EspProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<EspStatus>("disconnected");
  const isManualRef = useRef(false);

  const handleStatusChange = useCallback((s: EspStatus) => {
    setStatus(s);
  }, []);

  const { connect: wsConnect, disconnect: wsDisconnect, send, getSocket } = useEsp32WebSocket(
    handleStatusChange,
    undefined,
    false  // 자동 연결 비활성화 — 버튼으로 수동 제어
  );

  // 청크 단위로 나눠 전송 후 각 청크마다 버퍼 flush 대기
  // ESP32 WebSocket 수신 버퍼 한계 초과 방지
  const CHUNK_SIZE = 1280; // 80프레임 × 16바이트
  const sendAndFlush = useCallback(async (data: Uint8Array | ArrayBuffer): Promise<void> => {
    const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);

    const waitFlush = (): Promise<void> => new Promise((resolve, reject) => {
      const deadline = Date.now() + 3000;
      const check = () => {
        const ws = getSocket();
        if (!ws || ws.readyState !== WebSocket.OPEN) { reject(new Error("소켓 끊김")); return; }
        if (ws.bufferedAmount === 0) { resolve(); return; }
        if (Date.now() > deadline) { reject(new Error("flush 타임아웃")); return; }
        setTimeout(check, 20);
      };
      check();
    });

    for (let offset = 0; offset < bytes.length; offset += CHUNK_SIZE) {
      const chunk = bytes.slice(offset, offset + CHUNK_SIZE);
      send(chunk);
      try {
        await waitFlush();
        console.log(`[ESP] 청크 전송: ${offset}~${offset + chunk.length} / ${bytes.length} bytes`);
      } catch (e) {
        console.warn("[ESP] 청크 전송 중단:", e);
        break;
      }
    }
  }, [send, getSocket]);

  // 수동 연결 (자동연결 훅의 useEffect connect를 끄고 수동으로 제어)
  const connect = useCallback(() => {
    isManualRef.current = false;
    wsConnect();
  }, [wsConnect]);

  const disconnect = useCallback(() => {
    isManualRef.current = true;
    wsDisconnect();
  }, [wsDisconnect]);

  const toggle = useCallback(() => {
    if (status === "connected" || status === "connecting") {
      disconnect();
    } else {
      // disconnected, error 모두 connect 시도
      connect();
    }
  }, [status, connect, disconnect]);

  return (
    <EspContext.Provider value={{
      status,
      isConnected: status === "connected",
      connect,
      disconnect,
      send,
      sendAndFlush,
      toggle,
    }}>
      {children}
    </EspContext.Provider>
  );
}

export function useEsp() {
  const ctx = useContext(EspContext);
  if (!ctx) throw new Error("useEsp must be used within EspProvider");
  return ctx;
}
