package com.example.sound.domain.video.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@NoArgsConstructor
@AllArgsConstructor
public class VideoResultMessage {

    private Long videoId;

    @JsonProperty("durationSec")
    private Double durationSec;

    private String status;

    private Result result;

    @Getter
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Result {

        @JsonProperty("subtitleKey")
        private String subtitleKey;

        @JsonProperty("vibrationKey")
        private String vibrationKey;

        @JsonProperty("vibrationBinKey")
        private String vibrationBinaryKey;

        @JsonProperty("soundEventKey")
        private String soundEventKey;
    }
}