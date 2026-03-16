package com.example.sound.domain.video.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;

import java.time.LocalDateTime;

@Getter
@AllArgsConstructor
public class VideoCommentResponse {

    private Long commentId;
    private String content;
    private String userNickname;
    private LocalDateTime createdAt;
}
