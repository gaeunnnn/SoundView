package com.example.sound.domain.video.service;

import com.example.sound.domain.album.entity.AlbumVideo;
import com.example.sound.domain.album.repository.AlbumVideoRepository;
import com.example.sound.domain.user.entity.User;
import com.example.sound.domain.user.repository.UserRepository;
import com.example.sound.domain.video.dto.VideoProcessMessage;
import com.example.sound.domain.video.dto.VideoResponse;
import com.example.sound.domain.video.dto.VideoUpdateRequest;
import com.example.sound.domain.video.dto.VideoUpdateResponse;
import com.example.sound.domain.video.entity.Video;
import com.example.sound.domain.video.entity.VideoFailReason;
import com.example.sound.domain.video.entity.VideoStatus;
import com.example.sound.domain.video.repository.VideoCommentRepository;
import com.example.sound.domain.video.repository.VideoReactionRepository;
import com.example.sound.domain.video.repository.VideoRepository;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import com.example.sound.global.config.RabbitMQConfig;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class VideoService {

    private final AlbumVideoRepository albumVideoRepository;
    private final VideoRepository videoRepository;
    private final VideoReactionRepository videoReactionRepository;
    private final VideoCommentRepository videoCommentRepository;
    private final UserRepository userRepository;
    private final RabbitTemplate rabbitTemplate;

    // 공유 앨범에서만 제거 (업로드 취소)
    @Transactional
    public void removeFromAlbum(Long albumVideoId, Long userId){

        AlbumVideo albumVideo = albumVideoRepository.findById(albumVideoId)
                .orElseThrow(() -> new RuntimeException("영상 없음"));

        // 업로더 확인
        if(!albumVideo.getVideo().getUploader().getId().equals(userId)){
            throw  new RuntimeException("업로드 취소 권한 없음");
        }

        videoCommentRepository.deleteByAlbumVideoId(albumVideoId);
        videoReactionRepository.deleteByAlbumVideoId(albumVideoId);

        albumVideoRepository.delete(albumVideo);
    }

    // 영상 자체 삭제
    @Transactional
    public void deleteVideo(Long videoId, Long userId) {

        Video video = videoRepository.findById(videoId)
                .orElseThrow(() -> new RuntimeException("영상 없음"));

        // 업로더 확인
        if (!video.getUploader().getId().equals(userId)) {
            throw new RuntimeException("삭제 권한 없음");
        }

        // 해당 영상이 포함된 모든 album_videos 조회
        var albumVideos = albumVideoRepository.findByVideo_Id(videoId);

        for(AlbumVideo av : albumVideos){
            videoCommentRepository.deleteByAlbumVideoId(av.getId());
            videoReactionRepository.deleteByAlbumVideoId(av.getId());
        }

        albumVideoRepository.deleteByVideo_Id(videoId);

        videoRepository.delete(video);
    }

    // 영상 제목 수정
    @Transactional
    public VideoUpdateResponse updateVideoTitle(
            Long videoId,
            Long userId,
            VideoUpdateRequest request
    ) {
        Video video = videoRepository.findById(videoId)
                .orElseThrow(()-> new IllegalArgumentException("영상이 없습니다."));

        // 업로더 확인
        if(!video.getUploader().getId().equals(userId)){
            throw new IllegalArgumentException("수정 권한이 없습니다.");
        }

        video.updateTitle(request.getTitle());

        return new VideoUpdateResponse(video.getId(), video.getTitle());
    }

    // 공유앨범에서 내가 업로드한 영상 조회
    public List<VideoResponse> getMyVideosInAlbum(Long albumId, Long userId) {

        List<Video> videos =
                videoRepository.findMyVideosInAlbum(albumId, userId);

        return videos.stream()
                .map(VideoResponse::from)
                .toList();
    }

    public VideoStatus getStatus(Long videoId) {

        Video video = videoRepository.findById(videoId)
                .orElseThrow(() -> new IllegalArgumentException("영상 없음"));

        return video.getStatus();
    }

    // 영상 생성 -> pending
    @Transactional
    public Long createVideo(Long userId, String title) {

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("유저 없음"));

        Video video = Video.builder()
                .uploader(user)
                .title(title)
                .build();

        videoRepository.save(video);

        return video.getId();
    }

    // 영상 업로드 완료 -> processing
    @Transactional
    public void markUploadComplete(Long videoId, Long userId, String videoUrl){

        Video video = videoRepository.findById(videoId)
                .orElseThrow(() -> new IllegalArgumentException("영상 없음"));

        if (!video.getUploader().getId().equals(userId)) {
            throw new IllegalArgumentException("업로드 완료 처리 권한 없음");
        }

        // 영상 URL 저장
        video.updateVideoUrl(videoUrl);

        // 상태 변경
        video.markProcessing();

        // MQ 메시지 발행
        VideoProcessMessage message = VideoProcessMessage.builder()
                .videoId(video.getId())
                .videoUrl(video.getVideoUrl())
                .build();

        rabbitTemplate.convertAndSend(
                RabbitMQConfig.EXCHANGE,
                RabbitMQConfig.ROUTING_KEY,
                message
        );
    }

    // 완료 처리 -> AI 콜백
    @Transactional
    public void completeVideo(Long videoId, String subtitleUrl) {
        Video video = videoRepository.findById(videoId)
                .orElseThrow(() -> new IllegalArgumentException("영상 없음"));

        video.markCompleted(subtitleUrl);
    }

    // 실패 처리
    @Transactional
    public void failVideo(Long videoId, VideoFailReason reason) {

        Video video = videoRepository.findById(videoId)
                .orElseThrow(() -> new IllegalArgumentException("영상 없음"));

        video.markFailed(reason);
    }
}
