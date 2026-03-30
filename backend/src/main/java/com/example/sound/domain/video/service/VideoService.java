package com.example.sound.domain.video.service;

import com.example.sound.domain.album.entity.Album;
import com.example.sound.domain.album.entity.AlbumVideo;
import com.example.sound.domain.album.repository.AlbumRepository;
import com.example.sound.domain.album.repository.AlbumUserRepository;
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
import com.example.sound.global.util.CloudFrontSigner;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import com.example.sound.global.config.RabbitMQConfig;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class VideoService {

    private final AlbumRepository albumRepository;
    private final AlbumUserRepository albumUserRepository;
    private final AlbumVideoRepository albumVideoRepository;
    private final VideoRepository videoRepository;
    private final VideoReactionRepository videoReactionRepository;
    private final VideoCommentRepository videoCommentRepository;
    private final UserRepository userRepository;
    private final RabbitTemplate rabbitTemplate;
    private final S3UploadService s3UploadService;
    private final NotificationService notificationService;
    private final CloudFrontSigner cloudFrontSigner;

    /**
     * 자막 및 사운드 이벤트 수정을 위한 Presigned URL 발급
     */
    @Transactional(readOnly = true)
    public VideoEditSaveResponse generateEditSaveUrls(Long videoId, Long userId) {
        Video video = videoRepository.findById(videoId)
                .orElseThrow(() -> new IllegalArgumentException("영상을 찾을 수 없습니다."));

        // 업로더만 수정 가능 (보안)
        if (!video.getUploader().getId().equals(userId)) {
            throw new AccessDeniedException("수정 권한이 없습니다.");
        }

        // 기존 S3 키가 없는 경우 (아직 처리가 안 된 영상 등)
        if (video.getSubtitleS3Key() == null || video.getSoundEventS3Key() == null) {
            throw new IllegalStateException("아직 수정할 수 없는 상태의 영상입니다.");
        }

        String subtitleUrl = s3UploadService.generatePresignedUrlForPut(video.getSubtitleS3Key());
        String soundEventUrl = s3UploadService.generatePresignedUrlForPut(video.getSoundEventS3Key());

        return VideoEditSaveResponse.builder()
                .subtitleUploadUrl(subtitleUrl)
                .soundEventUploadUrl(soundEventUrl)
                .build();
    }

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
                .map(v -> VideoResponse.from(v, cloudFrontSigner))
                .toList();
    }

    public VideoStatus getStatus(Long videoId) {

        Video video = videoRepository.findById(videoId)
                .orElseThrow(() -> new IllegalArgumentException("영상 없음"));

        return video.getStatus();
    }

    /**
     * 통짜 업로드 (서버 경유 방식 - 성능 비교용)
     */
    @Transactional
    public Long uploadVideoMonolithic(Long userId, MultipartFile file, String title) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("유저 없음"));

        // 1. S3 Key 생성
        String s3Key = s3UploadService.generateS3Key(file.getOriginalFilename());
        String thumbKey = s3UploadService.generateThumbnailKey(s3Key);

        // 2. S3에 직접 업로드 (서버가 파일을 받아서 전달)
        s3UploadService.uploadMultipartFile(file, s3Key);

        // 3. DB 저장 (이미 업로드가 완료되었으므로 바로 PROCESSING 상태)
        Video video = Video.builder()
                .uploader(user)
                .title(title)
                .videoS3Key(s3Key)
                .thumbnailS3Key(thumbKey)
                .originalFileName(file.getOriginalFilename())
                .status(VideoStatus.PROCESSING)
                .build();

        videoRepository.save(video);

        // 4. 내 앨범에 자동 추가
        albumRepository.findByOwnerIdAndName(userId, "내 앨범").ifPresent(album -> {
            AlbumVideo albumVideo = AlbumVideo.builder()
                    .album(album)
                    .video(video)
                    .build();
            albumVideoRepository.save(albumVideo);
        });

        // 5. MQ 발행 (AI 처리 요청)
        VideoProcessMessage message = VideoProcessMessage.builder()
                .videoId(video.getId())
                .objectKey(video.getVideoS3Key())
                .build();

        rabbitTemplate.convertAndSend(
                RabbitMQConfig.EXCHANGE,
                RabbitMQConfig.REQUEST_KEY,
                message
        );

        return video.getId();
    }

    /**
     * S3 멀티파트 업로드 시작 로직
     */
    @Transactional
    public VideoUploadInitiateResponse initiateVideoUpload(Long userId, VideoUploadInitiateRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("유저 없음"));

        // 1. S3 Key 생성 (private/ 프리픽스 포함)
        String s3Key = s3UploadService.generateS3Key(request.getFileName());

        // 2. 썸네일 S3 Key 미리 생성
        String thumbKey = s3UploadService.generateThumbnailKey(s3Key);

        // 3. S3 멀티파트 업로드 초기화 (Upload ID 발급)
        String uploadId = s3UploadService.initiateMultipartUpload(s3Key);

        // 4. DB에 Video 엔티티 생성 (PENDING 상태)
        Video video = Video.builder()
                .uploader(user)
                .title(request.getTitle())
                .videoS3Key(s3Key)
                .thumbnailS3Key(thumbKey)
                .uploadId(uploadId)
                .originalFileName(request.getFileName())
                .status(VideoStatus.PENDING)
                .build();

        videoRepository.save(video);

        // 5. 각 파트별 Presigned URL 생성
        List<String> presignedUrls = s3UploadService.generatePresignedUrls(s3Key, uploadId, request.getPartCount());

        return VideoUploadInitiateResponse.builder()
                .videoId(video.getId())
                .uploadId(uploadId)
                .videoS3Key(s3Key)
                .thumbnailS3Key(thumbKey)
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

        // 3. 내 앨범에 자동 추가
        albumRepository.findByOwnerIdAndName(userId, "내 앨범").ifPresent(album -> {
            boolean alreadyExists = albumVideoRepository.existsByAlbumIdAndVideoId(album.getId(), video.getId());
            if (!alreadyExists) {
                AlbumVideo albumVideo = AlbumVideo.builder()
                        .album(album)
                        .video(video)
                        .build();
                albumVideoRepository.save(albumVideo);
            }
        });

        // 4.MQ 발행
        VideoProcessMessage message = VideoProcessMessage.builder()
                .videoId(video.getId())
                .objectKey(video.getVideoS3Key())
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

    public VideoDetailResponse getVideoDetail(Long videoId) {

        Video video = videoRepository.findById(videoId)
                .orElseThrow(() -> new IllegalArgumentException("영상 없음"));

        // 실패
        if (video.getStatus() == VideoStatus.FAILED) {
            return VideoDetailResponse.builder()
                    .videoId(video.getId())
                    .title(video.getTitle())
                    .status(video.getStatus().name())
                    .failReason(
                            video.getFailReason() != null ? video.getFailReason().name() : null
                    )
                    .build();
        }

        // 처리 중
        if (video.getStatus() != VideoStatus.COMPLETED) {
            return VideoDetailResponse.builder()
                    .videoId(video.getId())
                    .title(video.getTitle())
                    .status(video.getStatus().name())
                    .build();
        }

        // 완료
        return VideoDetailResponse.from(video, cloudFrontSigner);
    }

    @Transactional(readOnly = true)
    public VideoFullResponse getVideoFull(Long albumVideoId, Long userId) {

        // 1. albumVideoId로 연결 정보 조회
        AlbumVideo albumVideo = albumVideoRepository.findById(albumVideoId)
                .orElseThrow(() -> new IllegalArgumentException("해당 영상이 앨범에 존재하지 않습니다."));

        // 2. 권한 검증: 사용자가 해당 앨범의 멤버인지 확인
        if (!albumUserRepository.existsByAlbumIdAndUserId(albumVideo.getAlbum().getId(), userId)) {
            throw new AccessDeniedException("해당 영상에 대한 접근 권한이 없습니다.");
        }

        Long videoId = albumVideo.getVideo().getId();

        // 3. 영상 상세 정보
        VideoDetailResponse videoDetail = getVideoDetail(videoId);

        // 4. 댓글 (albumVideoId 기준 조회)
        List<VideoCommentResponse> comments =
                videoCommentRepository.findByAlbumVideoId(albumVideoId);

        // 5. 리액션 count (albumVideoId 기준 조회)
        List<Object[]> results =
                videoReactionRepository.countReactionsByAlbumVideoId(albumVideoId);

        // 6. 내가 누른 리액션 (albumVideoId 기준 조회)
        List<String> myReactions =
                videoReactionRepository.findMyReactionsByAlbumVideoIdAndUserId(albumVideoId, userId);

        // 7. 리액션 DTO 변환
        List<VideoReactionSummaryResponse.ReactionInfo> reactionInfos =
                results.stream()
                        .map(r -> {
                            String emoji = (String) r[0];
                            Long count = (Long) r[1];

                            return VideoReactionSummaryResponse.ReactionInfo.builder()
                                    .emoji(emoji)
                                    .count(count)
                                    .selected(myReactions.contains(emoji))
                                    .build();
                        })
                        .toList();

        VideoReactionSummaryResponse summary =
                VideoReactionSummaryResponse.builder()
                        .videoId(videoId)
                        .reactions(reactionInfos)
                        .build();

        return VideoFullResponse.builder()
                .video(videoDetail)
                .comments(comments)
                .reactionSummary(summary)
                .build();
    }
}
