package com.example.sound.domain.video.dto;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class VideoProcessMessage {

    private Long videoId;
    private String videoUrl;
}
