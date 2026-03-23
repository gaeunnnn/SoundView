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

    @JsonProperty("duration_sec")
    private Double durationSec;

    private String status;

    private Result result;

    @Getter
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Result {

        @JsonProperty("subtitle_key")
        private String subtitleKey;

        @JsonProperty("vibration_key")
        private String vibrationKey;

        @JsonProperty("vibrationbinary_key")
        private String vibrationBinaryKey;

        @JsonProperty("sound_event_key")
        private String soundEventKey;
    }
}