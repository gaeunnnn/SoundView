package com.example.sound.domain.video.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class VideoUpdateResponse {

    private Long videoId;
    private String title;
}
