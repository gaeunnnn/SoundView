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
    private String videoUrl;
    private String thumbnailUrl;
    private BigDecimal durationSec;
    private LocalDateTime createdAt;
    private String status;

    public static VideoResponse from(Video video, String cloudFrontDomain) {
        String baseUrl = "https://" + cloudFrontDomain + "/";

        return VideoResponse.builder()
                .videoId(video.getId())
                .title(video.getTitle())
                .videoUrl(video.getVideoS3Key() != null ? baseUrl + video.getVideoS3Key() : null)
                .thumbnailUrl(video.getThumbnailS3Key() != null ? baseUrl + video.getThumbnailS3Key() : null)
                .durationSec(video.getDurationSec())
                .createdAt(video.getCreatedAt())
                .status(video.getStatus().name())
                .build();
    }
}