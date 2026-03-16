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
    private String thumbnailUrl;
    private BigDecimal durationSec;
    private String uploaderName;
    private Long commentCount;
    private Long reactionCount;
    private LocalDateTime createdAt;
}