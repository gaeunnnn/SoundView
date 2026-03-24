package com.example.sound.domain.video.controller;

import com.example.sound.domain.user.entity.User;
import com.example.sound.domain.video.dto.*;
import com.example.sound.domain.video.entity.VideoStatus;
import com.example.sound.domain.video.service.VideoService;
import com.example.sound.global.auth.oauth.CustomUserPrincipal;
import io.swagger.v3.oas.annotations.Operation;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api")
public class VideoController {

    private final VideoService videoService;

    // 공유앨범에서만 제거 (업로드 취소)
    @Operation(summary = "공유 앨범에서 영상 제거 (업로드 취소)")
    @DeleteMapping("/album-videos/{albumVideoId}")
    public void removeFromAlbum(
            @PathVariable Long albumVideoId,
            @AuthenticationPrincipal CustomUserPrincipal principal
    ) {
        videoService.removeFromAlbum(albumVideoId, principal.getId());
    }

    // 영상 자체 삭제
    @Operation(summary = "영상 삭제")
    @DeleteMapping("/videos/{videoId}")
    public void deleteVideo(
            @PathVariable Long videoId,
            @AuthenticationPrincipal CustomUserPrincipal principal
    ) {
        videoService.deleteVideo(videoId, principal.getId());
    }

    // 영상 제목 수정
    @Operation(summary = "영상 제목 수정")
    @PatchMapping("/videos/{videoId}")
    public VideoUpdateResponse updateVideoTitle(
            @PathVariable Long videoId,
            @AuthenticationPrincipal CustomUserPrincipal principal,
            @RequestBody VideoUpdateRequest request
    ){
        return videoService.updateVideoTitle(videoId,principal.getId(),request);
    }

    // 공유 앨범에서 내가 만든 영상 조회
    @Operation(summary = "공유 앨범에서 내가 업로드한 영상 조회")
    @GetMapping("/albums/{albumId}/videos/my")
    public List<VideoResponse> getMyVideosInAlbum(
            @PathVariable Long albumId,
            @AuthenticationPrincipal CustomUserPrincipal principal
    ) {
        return videoService.getMyVideosInAlbum(albumId, principal.getId());
    }

    @Operation(summary = "S3 멀티파트 업로드 시작 (Presigned URL 발급)")
    @PostMapping("/videos/upload/initiate")
    public VideoUploadInitiateResponse initiateUpload(
            @AuthenticationPrincipal CustomUserPrincipal principal,
            @RequestBody VideoUploadInitiateRequest request
    ) {
        return videoService.initiateVideoUpload(principal.getId(), request);
    }

    @Operation(summary = "S3 멀티파트 업로드 완료 (조각 병합)")
    @PostMapping("/videos/upload/complete")
    public void completeUpload(
            @AuthenticationPrincipal CustomUserPrincipal principal,
            @RequestBody VideoUploadCompleteRequest request
    ) {
        videoService.completeVideoUpload(principal.getId(), request);
    }

    @Operation(summary = "영상 처리 상태 조회")
    @GetMapping("/videos/{videoId}/status")
    public VideoStatus getStatus(@PathVariable Long videoId) {
        return videoService.getStatus(videoId);
    }

    @Operation(summary = "영상 상세 조회")
    @GetMapping("/videos/{videoId}")
    public VideoDetailResponse getVideoDetail(
            @PathVariable Long videoId
    ) {
        return videoService.getVideoDetail(videoId);
    }

    @GetMapping("/videos/{albumVideoId}/full")
    public VideoFullResponse getVideoFull(
            @PathVariable Long albumVideoId,
            @AuthenticationPrincipal CustomUserPrincipal principal
    ) {
        return videoService.getVideoFull(albumVideoId, principal.getId());
    }
}
