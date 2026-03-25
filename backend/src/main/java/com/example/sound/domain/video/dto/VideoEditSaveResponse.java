package com.example.sound.domain.video.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class VideoEditSaveResponse {
    private String subtitleUploadUrl;
    private String soundEventUploadUrl;
}
