package com.example.sound.domain.video.repository;

import com.example.sound.domain.video.entity.VideoReaction;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface VideoReactionRepository extends JpaRepository<VideoReaction, Long> {

    @Modifying
    @Query("""
        delete from VideoReaction vr
        where vr.albumVideo.id in (
            select av.id from AlbumVideo av where av.album.id = :albumId
        )
    """)
    void deleteByAlbumId(Long albumId);

    Optional<VideoReaction> findByAlbumVideoIdAndUserIdAndEmoji(
            Long albumVideoId,
            Long userId,
            String emoji
    );

    long countByAlbumVideoIdAndEmoji(Long albumVideoId, String emoji);

    void deleteByAlbumVideoIdAndUserIdAndEmoji(
            Long albumVideoId,
            Long userId,
            String emoji
    );

    void deleteByAlbumVideoId(Long albumVideoId);


    List<VideoReaction> findByAlbumVideoId(Long videoId);

    List<VideoReaction> findByAlbumVideoIdAndUserId(Long videoId, Long userId);
}