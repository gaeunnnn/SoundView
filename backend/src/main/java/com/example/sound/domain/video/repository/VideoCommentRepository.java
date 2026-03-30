package com.example.sound.domain.video.repository;

import com.example.sound.domain.video.dto.VideoCommentResponse;
import com.example.sound.domain.video.entity.VideoComment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface VideoCommentRepository extends JpaRepository<VideoComment, Long> {

    // 앨범 삭제 시 댓글 전체 삭제
    @Modifying
    @Query("""
        delete from VideoComment vc
        where vc.albumVideo.id in (
            select av.id from AlbumVideo av where av.album.id = :albumId
        )
    """)
    void deleteByAlbumId(Long albumId);

    // albumVideo 기준 댓글 조회
    List<VideoComment> findByAlbumVideoIdOrderByCreatedAtAsc(Long albumVideoId);

    // albumVideo 기준 댓글 삭제
    void deleteByAlbumVideoId(Long albumVideoId);

    //
    @Query("""
    select new com.example.sound.domain.video.dto.VideoCommentResponse(
        vc.id,
        vc.content,
        vc.user.nickname,
        vc.createdAt
    )
    from VideoComment vc
    where vc.albumVideo.id = :albumVideoId
    order by vc.createdAt asc
""")
    List<VideoCommentResponse> findByAlbumVideoId(Long albumVideoId);

    @Query("""
    select new com.example.sound.domain.video.dto.VideoCommentResponse(
        vc.id,
        vc.content,
        vc.user.nickname,
        vc.createdAt
    )
    from VideoComment vc
    where vc.albumVideo.video.id = :videoId
    order by vc.createdAt asc
""")
    List<VideoCommentResponse> findByVideoId(Long videoId);
}