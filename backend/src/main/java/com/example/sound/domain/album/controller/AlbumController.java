package com.example.sound.domain.album.controller;

import com.example.sound.domain.album.dto.*;
import com.example.sound.domain.album.service.AlbumService;
import com.example.sound.domain.user.entity.User;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/albums")
@Tag(name = "Album", description = "앨범 API")
public class AlbumController {

    private final AlbumService albumService;

    @Operation(summary = "앨범 목록 조회", description = "로그인 사용자가 속한 앨범 목록을 조회합니다.")
    @GetMapping
    public List<AlbumResponse> getAlbums(
            @AuthenticationPrincipal User user
    ) {
        return albumService.getUserAlbums(user.getId());
    }

    @PostMapping
    public AlbumCreateResponse createAlbum(
            @AuthenticationPrincipal User user,
            @RequestBody AlbumCreateRequest request
    ) {
        return albumService.createAlbum(user.getId(), request);
    }

    @DeleteMapping("/{albumId}/leave")
    public void leaveAlbum(
            @PathVariable Long albumId,
            @AuthenticationPrincipal User user
    ) {
        albumService.leaveAlbum(albumId, user.getId());
    }

    @PatchMapping("/{albumId}")
    public ResponseEntity<AlbumUpdateResponse> updateAlbum(
            @PathVariable Long albumId,
            @RequestBody AlbumUpdateRequest request,
            @AuthenticationPrincipal User user
    ){

        AlbumUpdateResponse response =
                albumService.updateAlbum(albumId, user.getId(), request);

        return ResponseEntity.ok(response);
    }
}