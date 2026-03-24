package com.example.sound.domain.video.dto;

import com.example.sound.domain.video.entity.Video;
import com.example.sound.global.util.CloudFrontSigner;
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

    public static VideoResponse from(Video video, CloudFrontSigner signer) {
        return VideoResponse.builder()
                .videoId(video.getId())
                .title(video.getTitle())
                .videoUrl(signer.generatePublicUrl(video.getVideoS3Key()))
                .thumbnailUrl(signer.generatePublicUrl(video.getThumbnailS3Key()))
                .durationSec(video.getDurationSec())
                .createdAt(video.getCreatedAt())
                .status(video.getStatus().name())
                .build();
    }
}
