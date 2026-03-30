package com.example.sound.domain.video.repository;

import com.example.sound.domain.video.entity.VideoReaction;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface VideoReactionRepository extends JpaRepository<VideoReaction, Long> {

    // 앨범 삭제 시 리액션 전체 삭제
    @Modifying
    @Query("""
        delete from VideoReaction vr
        where vr.albumVideo.id in (
            select av.id from AlbumVideo av where av.album.id = :albumId
        )
    """)
    void deleteByAlbumId(Long albumId);

    // 리액션 존재 여부 (토글용)
    Optional<VideoReaction> findByAlbumVideoIdAndUserIdAndEmoji(
            Long albumVideoId,
            Long userId,
            String emoji
    );

    // 특정 리액션 개수 (albumVideo 기준)
    long countByAlbumVideoIdAndEmoji(Long albumVideoId, String emoji);

    // 리액션 삭제 (토글용)
    void deleteByAlbumVideoIdAndUserIdAndEmoji(
            Long albumVideoId,
            Long userId,
            String emoji
    );

    // albumVideo 기준 전체 삭제
    void deleteByAlbumVideoId(Long albumVideoId);

    List<VideoReaction> findByAlbumVideo_Video_Id(Long videoId);

    // user 기준 조회
    List<VideoReaction> findByAlbumVideo_Video_IdAndUserId(Long videoId, Long userId);

    @Query("""
        select vr.emoji, count(vr)
        from VideoReaction vr
        where vr.albumVideo.id = :albumVideoId
        group by vr.emoji
    """)
    List<Object[]> countReactionsByAlbumVideoId(Long albumVideoId);


    @Query("""
        select vr.emoji
        from VideoReaction vr
        where vr.albumVideo.id = :albumVideoId
          and vr.user.id = :userId
    """)
    List<String> findMyReactionsByAlbumVideoIdAndUserId(Long albumVideoId, Long userId);

    @Query("""
        select vr.emoji, count(vr)
        from VideoReaction vr
        where vr.albumVideo.video.id = :videoId
        group by vr.emoji
    """)
    List<Object[]> countReactions(Long videoId);


    @Query("""
        select vr.emoji
        from VideoReaction vr
        where vr.albumVideo.video.id = :videoId
          and vr.user.id = :userId
    """)
    List<String> findMyReactions(Long videoId, Long userId);
}