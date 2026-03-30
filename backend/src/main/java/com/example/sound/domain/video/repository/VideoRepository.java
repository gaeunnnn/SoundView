package com.example.sound.domain.video.repository;

import com.example.sound.domain.video.entity.Video;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface VideoRepository extends JpaRepository<Video, Long> {

    @Query("""
        select v
        from AlbumVideo av
        join av.video v
        where av.album.id = :albumId
        and v.uploader.id = :userId
    """)
    List<Video> findMyVideosInAlbum(Long albumId, Long userId);

}
