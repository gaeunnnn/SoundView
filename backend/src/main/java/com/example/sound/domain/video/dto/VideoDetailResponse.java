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

    public static VideoDetailResponse from(Video v, String domain) {
        return VideoDetailResponse.builder()
                .videoId(v.getId())
                .title(v.getTitle())
                .videoUrl(toUrl(domain, v.getVideoS3Key()))
                .thumbnailUrl(toUrl(domain, v.getThumbnailS3Key()))
                .durationSec(v.getDurationSec())
                .status(v.getStatus().name())
                .subtitleUrl(toUrl(domain, v.getSubtitleS3Key()))
                .vibrationUrl(toUrl(domain, v.getVibrationS3Key()))
                .vibrationBinaryUrl(toUrl(domain, v.getVibrationBinaryS3Key()))
                .soundEventUrl(toUrl(domain, v.getSoundEventS3Key()))
                .build();
    }

    private static String toUrl(String domain, String key) {
        if (key == null) return null;
        return domain + "/" + key;
    }
}