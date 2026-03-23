package com.example.sound.domain.video.dto;

import com.example.sound.domain.video.entity.Video;
import lombok.Builder;
import lombok.Getter;

import java.math.BigDecimal;

@Getter
@Builder
public class VideoDetailResponse {

    private Long videoId;
    private String title;

    private String videoUrl;
    private String thumbnailUrl;

    private BigDecimal durationSec;
    private String status;
    private String failReason;

    // AI 결과
    private String subtitleUrl;
    private String vibrationUrl;
    private String vibrationBinaryUrl;
    private String soundEventUrl;

    public static VideoDetailResponse from(Video v, com.example.sound.global.util.CloudFrontSigner signer) {
        return VideoDetailResponse.builder()
                .videoId(v.getId())
                .title(v.getTitle())
                .videoUrl(signer.generateSignedUrl(v.getVideoS3Key()))
                .thumbnailUrl(signer.generatePublicUrl(v.getThumbnailS3Key()))
                .durationSec(v.getDurationSec())
                .status(v.getStatus().name())
                .subtitleUrl(signer.generateSignedUrl(v.getSubtitleS3Key()))
                .vibrationUrl(signer.generateSignedUrl(v.getVibrationS3Key()))
                .vibrationBinaryUrl(signer.generateSignedUrl(v.getVibrationBinaryS3Key()))
                .soundEventUrl(signer.generateSignedUrl(v.getSoundEventS3Key()))
                .build();
    }
}