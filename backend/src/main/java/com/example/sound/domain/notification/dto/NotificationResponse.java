package com.example.sound.domain.notification.dto;

import com.example.sound.domain.notification.entity.Notification;
import lombok.Builder;
import lombok.Getter;

import java.time.LocalDateTime;

@Getter
@Builder
public class NotificationResponse {

    private Long id;
    private String type;
    private String message;
    private boolean isRead;
    private LocalDateTime createdAt;

    public static NotificationResponse from(Notification notification){
        String fullMessage = (notification.getSender() != null)
                ? notification.getSender().getNickname() + notification.getMessage()
                : notification.getMessage();

        return NotificationResponse.builder()
                .id(notification.getId())
                .type(notification.getType().name())
                .message(fullMessage)
                .isRead(notification.isRead())
                .createdAt(notification.getCreatedAt())
                .build();
    }
}