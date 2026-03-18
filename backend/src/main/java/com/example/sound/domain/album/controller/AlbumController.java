package com.example.sound.domain.album.controller;

import com.example.sound.domain.album.dto.*;
import com.example.sound.domain.album.service.AlbumService;
import com.example.sound.domain.user.entity.User;
import com.example.sound.global.auth.oauth.CustomUserPrincipal;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
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
            @AuthenticationPrincipal CustomUserPrincipal principal
    ) {
        return albumService.getUserAlbums(principal.getId());
    }

    @Operation(summary = "앨범 생성")
    @PostMapping
    public AlbumCreateResponse createAlbum(
            @AuthenticationPrincipal CustomUserPrincipal principal,
            @RequestBody AlbumCreateRequest request
    ) {
        return albumService.createAlbum(principal.getId(), request);
    }

    @Operation(summary = "앨범 나가기")
    @DeleteMapping("/{albumId}/leave")
    public void leaveAlbum(
            @PathVariable Long albumId,
            @AuthenticationPrincipal CustomUserPrincipal principal
    ) {
        albumService.leaveAlbum(albumId, principal.getId());
    }

    @Operation(summary = "앨범 수정")
    @PatchMapping("/{albumId}")
    public ResponseEntity<AlbumUpdateResponse> updateAlbum(
            @PathVariable Long albumId,
            @RequestBody AlbumUpdateRequest request,
            @AuthenticationPrincipal CustomUserPrincipal principal
    ) {

        AlbumUpdateResponse response =
                albumService.updateAlbum(albumId, principal.getId(), request);

        return ResponseEntity.ok(response);
    }

    @Operation(summary = "공유 앨범에 영상 추가", description = "내 영상들을 선택하여 공유 앨범에 추가합니다.")
    @PostMapping("/{albumId}/videos")
    public ResponseEntity<AlbumVideoAddResponse> addVideosToAlbum(
            @PathVariable Long albumId,
            @AuthenticationPrincipal CustomUserPrincipal principal,
            @RequestBody AlbumVideoAddRequest request
    ) {

        AlbumVideoAddResponse response =
                albumService.addVideosToAlbum(albumId, principal.getId(), request);

        return ResponseEntity.ok(response);
    }

    @Operation(summary = "공유 앨범 멤버 조회")
    @GetMapping("/{albumId}/users")
    public ResponseEntity<List<AlbumUserResponse>> getAlbumUsers(
            @PathVariable Long albumId,
            @AuthenticationPrincipal CustomUserPrincipal principal
    ) {

        List<AlbumUserResponse> users =
                albumService.getAlbumUsers(albumId, principal.getId());

        return ResponseEntity.ok(users);
    }

    @Operation(summary = "앨범 영상 개수 조회")
    @GetMapping("/{albumId}/video-count")
    public ResponseEntity<AlbumVideoCountResponse> getAlbumVideoCount(
            @PathVariable Long albumId
    ) {

        AlbumVideoCountResponse response =
                albumService.getAlbumVideoCount(albumId);

        return ResponseEntity.ok(response);
    }
}