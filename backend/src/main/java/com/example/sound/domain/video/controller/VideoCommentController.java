package com.example.sound.domain.video.controller;

import com.example.sound.domain.user.entity.User;
import com.example.sound.domain.video.dto.VideoCommentRequest;
import com.example.sound.domain.video.dto.VideoCommentResponse;
import com.example.sound.domain.video.service.VideoCommentService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api")
public class VideoCommentController {

    private final VideoCommentService videoCommentService;

    @GetMapping("/videos/{videoId}/comments")
    public List<VideoCommentResponse> getComments(
            @PathVariable Long videoId
    ){
        return videoCommentService.getComments(videoId);
    }

    @PostMapping("/videos/{videoId}/comments")
    public VideoCommentResponse addComment(
            @PathVariable Long videoId,
            @RequestBody VideoCommentRequest request,
            @AuthenticationPrincipal User user
    ){
        return videoCommentService.addComment(videoId, user.getId(), request);
    }

    @DeleteMapping("/comments/{commentId}")
    public void deleteComment(
            @PathVariable Long commentId,
            @AuthenticationPrincipal User user
    ){
        videoCommentService.deleteComment(commentId, user.getId());
    }
}