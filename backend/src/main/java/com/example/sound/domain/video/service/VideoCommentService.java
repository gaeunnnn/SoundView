package com.example.sound.domain.video.service;

import com.example.sound.domain.album.entity.AlbumVideo;
import com.example.sound.domain.album.repository.AlbumVideoRepository;
import com.example.sound.domain.user.entity.User;
import com.example.sound.domain.user.repository.UserRepository;
import com.example.sound.domain.video.dto.VideoCommentRequest;
import com.example.sound.domain.video.dto.VideoCommentResponse;
import com.example.sound.domain.video.entity.VideoComment;
import com.example.sound.domain.notification.service.NotificationService;
import com.example.sound.domain.video.repository.VideoCommentRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class VideoCommentService {

    private final VideoCommentRepository videoCommentRepository;
    private final AlbumVideoRepository albumVideoRepository;
    private final UserRepository userRepository;
    private final NotificationService notificationService;

    @Transactional
    public VideoCommentResponse addComment(Long albumVideoId, Long userId, VideoCommentRequest request) {

        AlbumVideo albumVideo = albumVideoRepository.findById(albumVideoId)
                .orElseThrow(() -> new RuntimeException("영상 없음"));

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("유저 없음"));

        VideoComment comment = VideoComment.builder()
                .albumVideo(albumVideo)
                .user(user)
                .content(request.getContent())
                .build();

        videoCommentRepository.save(comment);

        // 댓글 알림 전송
        Long ownerId = albumVideo.getVideo().getUploader().getId();

        if(!ownerId.equals(userId)){

            notificationService.notifyVideoComment(
                    ownerId,
                    albumVideo.getVideo().getId(),
                    user.getNickname()
            );
        }

        return new VideoCommentResponse(
                comment.getId(),
                comment.getContent(),
                user.getNickname(),
                comment.getCreatedAt()
        );
    }

    @Transactional(readOnly = true)
    public List<VideoCommentResponse> getComments(Long videoId) {

        return videoCommentRepository
                .findByAlbumVideoIdOrderByCreatedAtAsc(videoId)
                .stream()
                .map(c -> new VideoCommentResponse(
                        c.getId(),
                        c.getContent(),
                        c.getUser().getNickname(),
                        c.getCreatedAt()
                ))
                .toList();
    }

    @Transactional
    public void deleteComment(Long commentId, Long userId) {

        VideoComment comment = videoCommentRepository.findById(commentId)
                .orElseThrow(() -> new RuntimeException("댓글 없음"));

        if (!comment.getUser().getId().equals(userId)) {
            throw new RuntimeException("삭제 권한 없음");
        }

        videoCommentRepository.delete(comment);
    }
}
