package com.example.sound.domain.video.dto;

import com.example.sound.domain.video.entity.Video;
import lombok.Builder;
import lombok.Getter;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Getter
@Builder
public class VideoResponse {

    private Long videoId;
    private String title;
    private String thumbnailUrl;
    private BigDecimal durationSec;
    private LocalDateTime createdAt;

    public static VideoResponse from(Video video) {
        return VideoResponse.builder()
                .videoId(video.getId())
                .title(video.getTitle())
                .thumbnailUrl(video.getThumbnailUrl())
                .durationSec(video.getDurationSec())
                .createdAt(video.getCreatedAt())
                .build();
    }
}