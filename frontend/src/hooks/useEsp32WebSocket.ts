import { useEffect, useRef, useCallback } from "react";

const BASE_URL = import.meta.env.VITE_API_BASE_URL || "";
const WS_PROTOCOL = window.location.protocol === "https:" ? "wss://" : "ws://";
// "https://j14e203.p.ssafy.io/dev" -> "j14e203.p.ssafy.io/dev"
const DOMAIN = BASE_URL.replace("https://", "").replace("http://", "");
const ESP32_WS_URL = `${WS_PROTOCOL}${DOMAIN}/api/ws`;

const RECONNECT_DELAY_MS = 2000;

type Status = "connecting" | "connected" | "disconnected" | "error";

interface UseEsp32WebSocketReturn {
  connect: () => void;
  disconnect: () => void;
  send: (data: Uint8Array | ArrayBuffer) => void;
  getSocket: () => WebSocket | null;
}

/**
 * ESP32 WebSocket 연결을 관리하는 훅
 *
 * @param onStatusChange - 상태 변경 콜백
 * @param onMessage - 메시지 수신 콜백 (ArrayBuffer)
 */
export function useEsp32WebSocket(
  onStatusChange: (status: Status) => void,
  onMessage?: (data: ArrayBuffer | string) => void,
  autoConnect = true
): UseEsp32WebSocketReturn {
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isManualDisconnectRef = useRef<boolean>(false);
  // ref로 감싸서 connect/scheduleReconnect 간 순환 의존 없이 최신 함수를 참조
  const connectRef = useRef<() => void>(() => {});

  // 재연결 타이머 정리
  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimerRef.current !== null) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  // 재연결 예약 (중복 방지: 이미 타이머가 있으면 새로 만들지 않음)
  const scheduleReconnect = useCallback(() => {
    if (reconnectTimerRef.current !== null) return;
    console.log(`[WS] ${RECONNECT_DELAY_MS / 1000}초 후 재연결 시도...`);
    reconnectTimerRef.current = setTimeout(() => {
      reconnectTimerRef.current = null;
      connectRef.current(); // ref를 통해 최신 connect 호출
    }, RECONNECT_DELAY_MS);
  }, []);

  // WebSocket 연결 생성
  const connect = useCallback(() => {
    // 이미 OPEN 또는 CONNECTING 상태면 중복 연결 방지
    if (
      socketRef.current &&
      (socketRef.current.readyState === WebSocket.OPEN ||
        socketRef.current.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    isManualDisconnectRef.current = false;
    onStatusChange("connecting");
    console.log("[WS] 연결 시도:", ESP32_WS_URL);

    const ws = new WebSocket(ESP32_WS_URL);

    // 바이너리 수신 타입을 ArrayBuffer로 설정 (진동 chunk 수신용)
    ws.binaryType = "arraybuffer";

    // readyState 숫자 → 텍스트 변환 헬퍼
    const readyStateText = (state: number): string =>
      ["CONNECTING", "OPEN", "CLOSING", "CLOSED"][state] ?? String(state);

    ws.onopen = () => {
      console.log("[WS] WebSocket 연결 성공");
      console.log("[WS] readyState:", readyStateText(ws.readyState));
      onStatusChange("connected");
      clearReconnectTimer();
    };

    ws.onclose = (event: CloseEvent) => {
      console.log("[WS] WebSocket 연결 종료");
      console.log("[WS] close code:", event.code, "| reason:", event.reason || "(없음)");
      console.log("[WS] readyState:", readyStateText(ws.readyState));
      onStatusChange("disconnected");

      // 수동 disconnect가 아닌 경우에만 자동 재연결
      if (!isManualDisconnectRef.current) {
        scheduleReconnect();
      }
    };

    ws.onerror = (error: Event) => {
      console.error("[WS] WebSocket 에러 발생:", error);
      console.log("[WS] readyState:", readyStateText(ws.readyState));
      // onerror 직후 onclose도 발생하므로 여기서는 별도 상태 변경 안 함
    };

    ws.onmessage = (event: MessageEvent) => {
      console.log("[WS] 메시지 수신:", event.data);
      if (onMessage) {
        onMessage(event.data);
      }
    };

    socketRef.current = ws;
  }, [onStatusChange, onMessage, clearReconnectTimer, scheduleReconnect]);

  // connect가 갱신될 때마다 ref도 최신으로 유지
  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  // 수동 disconnect: 자동 재연결 없이 연결 종료
  const disconnect = useCallback(() => {
    isManualDisconnectRef.current = true;
    clearReconnectTimer();
    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }
    console.log("[WS] 수동 연결 종료");
  }, [clearReconnectTimer]);

  /**
   * 바이너리 데이터 전송 함수
   * 이후 진동 chunk 전송 시 이 함수를 확장하거나 래핑해서 사용
   */
  const send = useCallback((data: Uint8Array | ArrayBuffer) => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
      console.warn("[WS] 전송 불가: 소켓이 OPEN 상태가 아님");
      return;
    }
    socketRef.current.send(data);
    console.log("[WS] 전송:", data);
  }, []);

  // 마운트 시 자동 연결, 언마운트 시 정리
  useEffect(() => {
    if (autoConnect) connect();
    return () => {
      // 언마운트 시 재연결 타이머와 소켓 모두 정리
      clearReconnectTimer();
      if (socketRef.current) {
        isManualDisconnectRef.current = true;
        socketRef.current.close();
        socketRef.current = null;
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const getSocket = useCallback(() => socketRef.current, []);

  return { connect, disconnect, send, getSocket };
}
