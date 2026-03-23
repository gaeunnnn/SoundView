package com.example.sound.domain.video.dto;

import lombok.Builder;
import lombok.Getter;

import java.util.List;

@Getter
@Builder
public class VideoFullResponse {

    private VideoDetailResponse video;
    private List<VideoCommentResponse> comments;
    private VideoReactionSummaryResponse reactionSummary;
}