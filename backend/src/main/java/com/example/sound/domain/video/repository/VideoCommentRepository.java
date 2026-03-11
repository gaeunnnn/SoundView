package com.example.sound.domain.video.repository;

import com.example.sound.domain.video.entity.VideoComment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

public interface VideoCommentRepository extends JpaRepository<VideoComment, Long> {

    @Modifying
    @Query("""
        delete from VideoComment vc
        where vc.albumVideo.id in (
            select av.id from AlbumVideo av where av.album.id = :albumId
        )
    """)
    void deleteByAlbumId(Long albumId);
}