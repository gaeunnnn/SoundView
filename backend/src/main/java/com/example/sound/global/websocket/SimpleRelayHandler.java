package com.example.sound.global.websocket;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.BinaryMessage;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.AbstractWebSocketHandler;

import java.io.IOException;
import java.util.Set;
import java.util.concurrent.CopyOnWriteArraySet;

@Slf4j
@Component
public class SimpleRelayHandler extends AbstractWebSocketHandler {

    // 접속한 모든 세션(브라우저, ESP32)을 안전하게 담는 바구니입니다.
    private static final Set<WebSocketSession> sessions = new CopyOnWriteArraySet<>();

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        sessions.add(session);
        log.info("새로운 웹소켓 연결 성공: {}", session.getId());
    }

    // 🟢 텍스트 메시지 중계 (예: "PLAY_DONE", "STOPPED" 등)
    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        broadcast(session, message);
    }

    // 🔵 바이너리 메시지 중계 (예: 진동 데이터, 재생/정지 명령 등)
    // ⚠️ 이게 없으면 바이너리 데이터 수신 시 연결이 끊깁니다!
    @Override
    protected void handleBinaryMessage(WebSocketSession session, BinaryMessage message) throws Exception {
        broadcast(session, message);
    }

    /**
     * 메시지를 보낸 세션을 제외한 모든 세션에게 메시지를 그대로 전달합니다.
     */
    private void broadcast(WebSocketSession self, Object message) throws IOException {
        for (WebSocketSession s : sessions) {
            if (s.isOpen() && !s.getId().equals(self.getId())) {
                try {
                    if (message instanceof TextMessage) {
                        s.sendMessage((TextMessage) message);
                    } else if (message instanceof BinaryMessage) {
                        s.sendMessage((BinaryMessage) message);
                    }
                } catch (IOException e) {
                    log.error("메시지 전달 실패 (수신자: {}): {}", s.getId(), e.getMessage());
                }
            }
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        sessions.remove(session);
        log.info("웹소켓 연결 종료: {}, 사유: {}", session.getId(), status);
    }
}
