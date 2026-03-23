package com.example.sound.domain.video.service;

import com.example.sound.domain.album.entity.AlbumVideo;
import com.example.sound.domain.album.repository.AlbumVideoRepository;
import com.example.sound.domain.notification.service.NotificationService;
import com.example.sound.domain.user.entity.User;
import com.example.sound.domain.user.repository.UserRepository;
import com.example.sound.domain.video.dto.*;
import com.example.sound.domain.video.entity.Video;
import com.example.sound.domain.video.entity.VideoFailReason;
import com.example.sound.domain.video.entity.VideoStatus;
import com.example.sound.domain.video.repository.VideoCommentRepository;
import com.example.sound.domain.video.repository.VideoReactionRepository;
import com.example.sound.domain.video.repository.VideoRepository;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import com.example.sound.global.config.RabbitMQConfig;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
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
    private final S3UploadService s3UploadService;
    private final NotificationService notificationService;

    @Value("${spring.cloud.aws.cloudfront.domain}")
    private String cloudFrontDomain;

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
                .map(v -> VideoResponse.from(v, cloudFrontDomain))
                .toList();
    }

    public VideoStatus getStatus(Long videoId) {

        Video video = videoRepository.findById(videoId)
                .orElseThrow(() -> new IllegalArgumentException("영상 없음"));

        return video.getStatus();
    }

    /**
     * S3 멀티파트 업로드 시작 로직
     */
    @Transactional
    public VideoUploadInitiateResponse initiateVideoUpload(Long userId, VideoUploadInitiateRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("유저 없음"));

        // 1. S3 Key 생성
        String s3Key = s3UploadService.generateS3Key(request.getFileName());

        // 2. S3 멀티파트 업로드 초기화 (Upload ID 발급)
        String uploadId = s3UploadService.initiateMultipartUpload(s3Key);

        // 3. DB에 Video 엔티티 생성 (PENDING 상태)
        Video video = Video.builder()
                .uploader(user)
                .title(request.getTitle())
                .videoS3Key(s3Key)
                .uploadId(uploadId)
                .originalFileName(request.getFileName())
                .status(VideoStatus.PENDING)
                .build();

        videoRepository.save(video);

        // 4. 각 파트별 Presigned URL 생성
        List<String> presignedUrls = s3UploadService.generatePresignedUrls(s3Key, uploadId, request.getPartCount());

        return VideoUploadInitiateResponse.builder()
                .videoId(video.getId())
                .uploadId(uploadId)
                .videoS3Key(s3Key)
                .presignedUrls(presignedUrls)
                .build();
    }

    /**
     * S3 멀티파트 업로드 완료 로직 (병합)
     */
    @Transactional
    public void completeVideoUpload(Long userId, VideoUploadCompleteRequest request) {
        Video video = videoRepository.findById(request.getVideoId())
                .orElseThrow(() -> new IllegalArgumentException("영상 없음"));

        // 🌟 권한 검증: 비디오 업로더와 현재 로그인한 유저가 일치하는지 확인
        if (!video.getUploader().getId().equals(userId)) {
            throw new IllegalArgumentException("업로드 완료 권한이 없습니다.");
        }

        // 1. S3 조각 병합 실행
        s3UploadService.completeMultipartUpload(video.getVideoS3Key(), video.getUploadId(), request.getParts());

        // 2. 상태 변경 (PENDING -> PROCESSING)
        video.markProcessing();

        // 3.MQ 발행
        VideoProcessMessage message = VideoProcessMessage.builder()
                .videoId(video.getId())
                .videoKey(video.getVideoS3Key())
                .build();

        rabbitTemplate.convertAndSend(
                RabbitMQConfig.EXCHANGE,
                RabbitMQConfig.REQUEST_KEY,
                message
        );
    }


    // 완료 처리 -> AI 콜백
    @Transactional
    public void completeVideo(
            Long videoId,
            String subtitleS3Key,
            String vibrationS3Key,
            String vibrationBinaryS3Key,
            String soundEventS3Key,
            Double durationSec
    ) {

        Video video = videoRepository.findById(videoId)
                .orElseThrow(() -> new IllegalArgumentException("영상 없음"));

        if (video.getStatus() != VideoStatus.PROCESSING) {
            return;
        }

        video.markCompleted(subtitleS3Key);

        video.updateVibrationKey(vibrationS3Key);
        video.updateVibrationBinaryKey(vibrationBinaryS3Key);
        video.updateSoundEventKey(soundEventS3Key);

        if (durationSec != null) {
            video.updateDuration(durationSec);
        }

        notificationService.notifyVideoCompleted(
                video.getUploader().getId(),
                video.getId()
        );
    }

    // 실패 처리
    @Transactional
    public void failVideo(Long videoId, VideoFailReason reason) {

        Video video = videoRepository.findById(videoId)
                .orElseThrow(() -> new IllegalArgumentException("영상 없음"));

        if (video.getStatus() == VideoStatus.COMPLETED) {
            return;
        }

        video.markFailed(reason);
    }
}
