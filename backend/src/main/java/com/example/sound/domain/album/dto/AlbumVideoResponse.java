package com.example.sound.domain.album.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Getter
@AllArgsConstructor
public class AlbumVideoResponse {

    private Long albumVideoId;
    private Long videoId; // 추가된 필드
    private String title;
    private String thumbnailUrl; // thumbnailS3Key -> thumbnailUrl 변경
    private BigDecimal durationSec;
    private String uploaderName;
    private Long commentCount;
    private Long reactionCount;
    private LocalDateTime createdAt;

    // Full URL 변환 로직 (Service에서 호출)
    public void convertToFullUrl(com.example.sound.global.util.CloudFrontSigner signer) {
        if (this.thumbnailUrl != null) {
            this.thumbnailUrl = signer.generatePublicUrl(this.thumbnailUrl);
        }
    }
}
