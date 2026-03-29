package com.example.sound.global.config;

import com.example.sound.global.websocket.SimpleRelayHandler;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

@Configuration
@EnableWebSocket
@RequiredArgsConstructor
public class WebSocketConfig implements WebSocketConfigurer {

    private final SimpleRelayHandler simpleRelayHandler;

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        // "/api/ws" 엔드포인트로 들어오는 웹소켓 요청을 simpleRelayHandler가 처리하도록 등록합니다.
        // 모든 오리진(CORS)에서의 접속을 허용합니다.
        registry.addHandler(simpleRelayHandler, "/api/ws")
                .setAllowedOrigins("*");
    }
}
