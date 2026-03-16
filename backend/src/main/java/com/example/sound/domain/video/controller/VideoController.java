package com.example.sound.domain.video.controller;

import com.example.sound.domain.user.entity.User;
import com.example.sound.domain.video.service.VideoService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api")
public class VideoController {

    private final VideoService videoService;

    // 공유앨범에서만 제거 (업로드 취소)
    @DeleteMapping("/album-videos/{albumVideoId}")
    public void removeFromAlbum(
            @PathVariable Long albumVideoId,
            @AuthenticationPrincipal User user
    ) {
        videoService.removeFromAlbum(albumVideoId, user.getId());
    }

    // 영상 자체 삭제
    @DeleteMapping("/videos/{videoId}")
    public void deleteVideo(
            @PathVariable Long videoId,
            @AuthenticationPrincipal User user
    ) {
        videoService.deleteVideo(videoId, user.getId());
    }
}
