package com.example.sound.domain.video.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import java.util.List;

@Getter
@NoArgsConstructor
@AllArgsConstructor
public class VideoUploadCompleteRequest {
    private Long videoId;
    private String uploadId;
    private List<PartETagRequest> parts;

    @Getter
    @NoArgsConstructor
    @AllArgsConstructor
    public static class PartETagRequest {
        private Integer partNumber;
        
        @JsonProperty("eTag")
        private String eTag;
    }
}
