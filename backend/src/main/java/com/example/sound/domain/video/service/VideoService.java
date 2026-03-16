package com.example.sound.domain.video.service;

import com.example.sound.domain.album.entity.AlbumVideo;
import com.example.sound.domain.album.repository.AlbumRepository;
import com.example.sound.domain.album.repository.AlbumVideoRepository;
import com.example.sound.domain.video.entity.Video;
import com.example.sound.domain.video.repository.VideoCommentRepository;
import com.example.sound.domain.video.repository.VideoReactionRepository;
import com.example.sound.domain.video.repository.VideoRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class VideoService {

    private final AlbumVideoRepository albumVideoRepository;
    private final VideoRepository videoRepository;
    private final VideoReactionRepository videoReactionRepository;
    private final VideoCommentRepository videoCommentRepository;
    private final AlbumRepository albumRepository;

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
}
