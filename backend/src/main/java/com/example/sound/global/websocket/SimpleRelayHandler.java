package com.example.sound.global.websocket;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.io.IOException;
import java.util.Set;
import java.util.concurrent.CopyOnWriteArraySet;

@Slf4j
@Component
public class SimpleRelayHandler extends TextWebSocketHandler {

    // 접속한 모든 세션(브라우저, ESP32)을 안전하게 담는 바구니입니다.
    private static final Set<WebSocketSession> sessions = new CopyOnWriteArraySet<>();

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        sessions.add(session);
        log.info("새로운 웹소켓 연결 성공: {}", session.getId());
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        String payload = message.getPayload();
        log.info("메시지 수신 (발신자: {}): {}", session.getId(), payload);

        // 메시지를 보낸 사람을 제외한 모든 연결된 기기/브라우저에 메시지를 그대로 전달합니다.
        for (WebSocketSession s : sessions) {
            if (s.isOpen() && !s.getId().equals(session.getId())) {
                try {
                    s.sendMessage(new TextMessage(payload));
                } catch (IOException e) {
                    log.error("메시지 전달 실패 (수신자: {}): {}", s.getId(), e.getMessage());
                }
            }
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        sessions.remove(session);
        log.info("웹소켓 연결 종료: {}", session.getId());
    }
}
