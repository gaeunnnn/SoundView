package com.example.sound.domain.video.controller;

import com.example.sound.domain.user.entity.User;
import com.example.sound.domain.video.dto.VideoCommentRequest;
import com.example.sound.domain.video.dto.VideoCommentResponse;
import com.example.sound.domain.video.service.VideoCommentService;
import com.example.sound.global.auth.oauth.CustomUserPrincipal;
import io.swagger.v3.oas.annotations.Operation;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api")
public class VideoCommentController {

    private final VideoCommentService videoCommentService;

    @Operation(summary = "댓글 목록 조회")
    @GetMapping("/videos/{videoId}/comments")
    public List<VideoCommentResponse> getComments(
            @PathVariable Long videoId
    ){
        return videoCommentService.getComments(videoId);
    }

    @Operation(summary = "댓글 작성")
    @PostMapping("/videos/{videoId}/comments")
    public VideoCommentResponse addComment(
            @PathVariable Long videoId,
            @RequestBody VideoCommentRequest request,
            @AuthenticationPrincipal CustomUserPrincipal principal
    ){
        return videoCommentService.addComment(videoId, principal.getId(), request);
    }

    @Operation(summary = "댓글 삭제")
    @DeleteMapping("/comments/{commentId}")
    public void deleteComment(
            @PathVariable Long commentId,
            @AuthenticationPrincipal CustomUserPrincipal principal
    ){
        videoCommentService.deleteComment(commentId, principal.getId());
    }
}