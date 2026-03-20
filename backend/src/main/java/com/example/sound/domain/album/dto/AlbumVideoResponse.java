package com.example.sound.domain.album.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Getter
@AllArgsConstructor
public class AlbumVideoResponse {

    private Long albumVideoId;
    private String title;
    private String thumbnailS3Key;
    private BigDecimal durationSec;
    private String uploaderName;
    private Long commentCount;
    private Long reactionCount;
    private LocalDateTime createdAt;

    // Full URL 변환 로직 (Service에서 호출)
    public void convertToFullUrl(String cloudFrontDomain) {
        if (this.thumbnailS3Key != null) {
            this.thumbnailS3Key = "https://" + cloudFrontDomain + "/" + this.thumbnailS3Key;
        }
    }
}