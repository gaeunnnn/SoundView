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
                .videoUrl(signer.generateSignedUrl(v.getVideoS3Key())) // 영상만 Signed URL (보안 유지)
                .thumbnailUrl(signer.generatePublicUrl(v.getThumbnailS3Key()))
                .durationSec(v.getDurationSec())
                .status(v.getStatus().name())
                // 자막, 진동 데이터 등은 연산 속도를 위해 Public URL로 변경
                .subtitleUrl(signer.generatePublicUrl(v.getSubtitleS3Key()))
                .vibrationUrl(signer.generatePublicUrl(v.getVibrationS3Key()))
                .vibrationBinaryUrl(signer.generatePublicUrl(v.getVibrationBinaryS3Key()))
                .soundEventUrl(signer.generatePublicUrl(v.getSoundEventS3Key()))
                .build();
    }
}
