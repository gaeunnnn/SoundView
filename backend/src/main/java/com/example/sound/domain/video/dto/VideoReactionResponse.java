package com.example.sound.domain.video.dto;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class VideoReactionResponse {

    private String emoji;
    private long count;
}
