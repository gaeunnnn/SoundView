package com.example.sound.domain.video.controller;

import com.example.sound.domain.user.entity.User;
import com.example.sound.domain.video.dto.VideoReactionRequest;
import com.example.sound.domain.video.dto.VideoReactionResponse;
import com.example.sound.domain.video.dto.VideoReactionSummaryResponse;
import com.example.sound.domain.video.service.VideoReactionService;
import com.example.sound.global.auth.oauth.CustomUserPrincipal;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/videos")
@Tag(name = "Video Reaction", description = "영상 리액션 API")
public class VideoReactionController {

    private final VideoReactionService videoReactionService;

    @PostMapping("/{videoId}/reaction")
    public ResponseEntity<VideoReactionResponse> addReaction(
            @PathVariable Long videoId,
            @RequestBody VideoReactionRequest request,
            @AuthenticationPrincipal CustomUserPrincipal principal
    ){
        VideoReactionResponse response =  videoReactionService.addReaction(videoId, principal.getId(), request);

        return ResponseEntity.ok(response);
    }

    @Operation(summary = "영상 리액션 삭제")
    @DeleteMapping("/{videoId}/reaction")
    public ResponseEntity<Void> removeReaction(
            @PathVariable Long videoId,
            @RequestParam String emoji,
            @AuthenticationPrincipal  CustomUserPrincipal principal
    ){
        videoReactionService.removeReaction(videoId, principal.getId(), emoji);

        return ResponseEntity.ok().build();
    }

    @Operation(summary = "영상 리액션 조회")
    @GetMapping("/{videoId}/reaction")
    public ResponseEntity<VideoReactionSummaryResponse> getReactions(
            @PathVariable Long videoId,
            @AuthenticationPrincipal CustomUserPrincipal principal
    ){
        VideoReactionSummaryResponse response =
                videoReactionService.getReactions(videoId, principal.getId());

        return ResponseEntity.ok(response);
    }
}
