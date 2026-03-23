package com.example.sound.domain.video.service;

import com.example.sound.domain.album.entity.AlbumVideo;
import com.example.sound.domain.album.repository.AlbumVideoRepository;
import com.example.sound.domain.user.entity.User;
import com.example.sound.domain.user.repository.UserRepository;
import com.example.sound.domain.video.dto.VideoFullResponse;
import com.example.sound.domain.video.dto.VideoReactionRequest;
import com.example.sound.domain.video.dto.VideoReactionResponse;
import com.example.sound.domain.video.dto.VideoReactionSummaryResponse;
import com.example.sound.domain.video.entity.VideoReaction;
import com.example.sound.domain.video.repository.VideoReactionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class VideoReactionService {

    private final VideoReactionRepository reactionRepository;
    private final AlbumVideoRepository albumVideoRepository;
    private final UserRepository userRepository;

    @Transactional
    public VideoReactionResponse addReaction(Long videoId, Long userId, VideoReactionRequest request) {

        AlbumVideo video = albumVideoRepository.findById(videoId)
                .orElseThrow(() -> new RuntimeException("영상 없음"));

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("유저 없음"));

        reactionRepository.findByAlbumVideoIdAndUserIdAndEmoji(videoId, userId, request.getEmoji())
                .ifPresent(r -> {
                    throw new RuntimeException("이미 리액션 존재");
                });

        VideoReaction reaction = VideoReaction.builder()
                .albumVideo(video)
                .user(user)
                .emoji(request.getEmoji())
                .build();

        reactionRepository.save(reaction);

        long count = reactionRepository.countByAlbumVideoIdAndEmoji(videoId, request.getEmoji());

        return VideoReactionResponse.builder()
                .emoji(request.getEmoji())
                .count(count)
                .build();
    }

    @Transactional
    public void removeReaction(Long videoId, Long userId, String emoji) {

        reactionRepository.deleteByAlbumVideoIdAndUserIdAndEmoji(
                videoId,
                userId,
                emoji
        );
    }

    @Transactional(readOnly = true)
    public VideoReactionSummaryResponse getReactions(Long videoId, Long userId) {

        // 전체 리액션
        List<VideoReaction> reactions = reactionRepository.findByAlbumVideoId(videoId);

        // 내가 누른 리액션
        List<VideoReaction> myReactions = reactionRepository.findByAlbumVideoIdAndUserId(videoId, userId);

        Set<String> myEmojiSet = myReactions.stream()
                .map(VideoReaction::getEmoji)
                .collect(Collectors.toSet());

        // emoji별 count
        Map<String, Long> countMap = reactions.stream()
                .collect(Collectors.groupingBy(
                        VideoReaction::getEmoji,
                        Collectors.counting()
                ));

        List<VideoReactionSummaryResponse.ReactionInfo> result = countMap.entrySet().stream()
                .map(entry -> VideoReactionSummaryResponse.ReactionInfo.builder()
                        .emoji(entry.getKey())
                        .count(entry.getValue())
                        .selected(myEmojiSet.contains(entry.getKey()))
                        .build())
                .toList();

        return VideoReactionSummaryResponse.builder()
                .videoId(videoId)
                .reactions(result)
                .build();
    }
}
