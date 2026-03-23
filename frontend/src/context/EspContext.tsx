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

  // 전송 후 WebSocket 버퍼가 비워질 때까지 대기
  const sendAndFlush = useCallback((data: Uint8Array | ArrayBuffer): Promise<void> => {
    send(data);
    return new Promise((resolve) => {
      const check = () => {
        const ws = getSocket();
        if (!ws || ws.bufferedAmount === 0) { resolve(); return; }
        setTimeout(check, 20);
      };
      check();
    });
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
