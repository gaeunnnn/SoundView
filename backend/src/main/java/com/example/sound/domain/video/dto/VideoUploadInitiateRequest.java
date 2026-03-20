package com.example.sound.domain.video.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@NoArgsConstructor
@AllArgsConstructor
public class VideoUploadInitiateRequest {
    private String title;
    private String fileName;
    private Integer partCount;
}
