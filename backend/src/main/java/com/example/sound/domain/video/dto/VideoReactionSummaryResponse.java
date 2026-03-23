package com.example.sound.domain.video.dto;

import lombok.Builder;
import lombok.Getter;

import java.util.List;

@Getter
@Builder
public class VideoReactionSummaryResponse {

    private Long videoId;
    private List<ReactionInfo> reactions;

    @Getter
    @Builder
    public static class ReactionInfo {
        private String emoji;
        private long count;
        private boolean selected;
    }
}