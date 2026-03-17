package com.example.sound.domain.notification.controller;

import com.example.sound.domain.notification.service.NotificationService;
import com.example.sound.domain.user.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@RestController
@RequiredArgsConstructor
public class NotificationController {

    private final NotificationService notificationService;

    // sse 알림 구독
    @GetMapping("/api/notifications/subscribe")
    public SseEmitter subscribe(
            @AuthenticationPrincipal User user
    ){
        return notificationService.subscribe(user.getId());
    }
}
