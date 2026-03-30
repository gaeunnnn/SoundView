package com.example.sound.domain.video.listener;

import com.example.sound.domain.video.dto.VideoResultMessage;
import com.example.sound.domain.video.entity.VideoFailReason;
import com.example.sound.domain.video.service.VideoService;
import com.example.sound.global.config.RabbitMQConfig;
import lombok.RequiredArgsConstructor;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class VideoMessageListener {

    private final VideoService videoService;

    @RabbitListener(queues = RabbitMQConfig.RESPONSE_QUEUE)
    public void handleVideoResult(VideoResultMessage message) {

        if (message == null || message.getVideoId() == null) {
            return;
        }

        if ("SUCCESS".equalsIgnoreCase(message.getStatus())) {

            if (message.getResult() == null) {
                videoService.failVideo(
                        message.getVideoId(),
                        VideoFailReason.AI_PROCESS_FAILED
                );
                return;
            }

            videoService.completeVideo(
                    message.getVideoId(),
                    message.getResult().getSubtitleKey(),
                    message.getResult().getVibrationKey(),
                    message.getResult().getVibrationBinaryKey(),
                    message.getResult().getSoundEventKey(),
                    message.getDurationSec()
            );

        } else {

            videoService.failVideo(
                    message.getVideoId(),
                    VideoFailReason.AI_PROCESS_FAILED
            );
        }
    }
}