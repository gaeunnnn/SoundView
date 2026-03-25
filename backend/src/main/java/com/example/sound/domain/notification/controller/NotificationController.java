package com.example.sound.domain.notification.controller;

import com.example.sound.domain.notification.dto.NotificationResponse;
import com.example.sound.domain.notification.service.NotificationService;
import com.example.sound.global.auth.oauth.CustomUserPrincipal;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.List;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/notifications")
@Tag(name = "Notification", description = "알림 API")
public class NotificationController {

    private final NotificationService notificationService;

    @Operation(summary = "SSE 알림 구독", description = "로그인 사용자가 SSE를 통해 실시간 알림을 구독합니다. Nginx 버퍼링 방지 설정이 포함되어 있습니다.")
    @GetMapping(value = "/subscribe", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public ResponseEntity<SseEmitter> subscribe(
            @AuthenticationPrincipal CustomUserPrincipal principal,
            HttpServletResponse response
    ){
        // Nginx 버퍼링 방지 헤더 추가 (실시간성 보장)
        response.setHeader("X-Accel-Buffering", "no");
        
        SseEmitter emitter = notificationService.subscribe(principal.getId());
        return ResponseEntity.ok(emitter);
    }

    @Operation(summary = "알림 목록 조회", description = "로그인 사용자의 알림 목록을 최신순으로 조회합니다.")
    @GetMapping
    public List<NotificationResponse> getNotifications(
            @AuthenticationPrincipal CustomUserPrincipal principal
    ){
        return notificationService.getNotifications(principal.getId());
    }

    @Operation(summary = "읽지 않은 알림 개수 조회", description = "로그인 사용자의 읽지 않은 알림 개수를 조회합니다.")
    @GetMapping("/unread-count")
    public long getUnreadCount(
            @AuthenticationPrincipal CustomUserPrincipal principal
    ){
        return notificationService.getUnreadCount(principal.getId());
    }

    @Operation(summary = "알림 읽음 처리", description = "특정 알림을 읽음 상태로 변경합니다.")
    @PatchMapping("/{id}/read")
    public void readNotification(
            @PathVariable Long id
    ){
        notificationService.readNotification(id);
    }
}
