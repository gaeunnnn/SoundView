package com.example.sound.domain.video.dto;

import lombok.Builder;
import lombok.Getter;
import java.util.List;

@Getter
@Builder
public class VideoUploadInitiateResponse {
    private Long videoId;
    private String uploadId;
    private String videoS3Key;
    private String thumbnailS3Key;
    private List<String> presignedUrls;
}
