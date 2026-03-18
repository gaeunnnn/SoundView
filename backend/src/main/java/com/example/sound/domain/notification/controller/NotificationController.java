package com.example.sound.domain.notification.controller;

import com.example.sound.domain.notification.dto.NotificationResponse;
import com.example.sound.domain.notification.service.NotificationService;
import com.example.sound.domain.user.entity.User;
import com.example.sound.global.auth.oauth.CustomUserPrincipal;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
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

    @Operation(summary = "SSE 알림 구독", description = "로그인 사용자가 SSE(Server-Sent Events)를 통해 실시간 알림을 구독합니다.")
    @GetMapping("/subscribe")
    public SseEmitter subscribe(
            @AuthenticationPrincipal CustomUserPrincipal principal
    ){
        return notificationService.subscribe(principal.getId());
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