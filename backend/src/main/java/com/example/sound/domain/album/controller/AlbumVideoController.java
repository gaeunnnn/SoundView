package com.example.sound.domain.album.controller;

import com.example.sound.domain.album.dto.AlbumVideoResponse;
import com.example.sound.domain.album.service.AlbumVideoService;
import com.example.sound.domain.user.entity.User;
import com.example.sound.global.auth.oauth.CustomUserPrincipal;
import io.swagger.v3.oas.annotations.Operation;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/albums")
public class AlbumVideoController {

    private final AlbumVideoService albumVideoService;

    @Operation(summary = "앨범 영상 목록 조회")
    @GetMapping("/{albumId}/videos")
    public List<AlbumVideoResponse> getAlbumVideos(
            @PathVariable Long albumId,
            @AuthenticationPrincipal CustomUserPrincipal principal
    ) {
        return albumVideoService.getAlbumVideos(albumId, principal.getId());
    }
}