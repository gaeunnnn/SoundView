package com.example.sound.domain.album.repository;

import com.example.sound.domain.album.dto.AlbumVideoResponse;
import com.example.sound.domain.album.entity.AlbumVideo;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface AlbumVideoRepository extends JpaRepository<AlbumVideo, Long> {


    @Query("""
SELECT new com.example.sound.domain.album.dto.AlbumVideoResponse(
    av.id,
    v.title,
    v.thumbnailUrl,
    v.durationSec,
    v.uploader.nickname,
    COUNT(DISTINCT vc.id),
    COUNT(DISTINCT vr.id),
    v.createdAt
)
FROM AlbumVideo av
JOIN av.video v
LEFT JOIN VideoComment vc ON vc.albumVideo.id = av.id
LEFT JOIN VideoReaction vr ON vr.albumVideo.id = av.id
WHERE av.album.id = :albumId
GROUP BY av.id, v.title, v.thumbnailUrl, v.durationSec, v.uploader.nickname, v.createdAt
""")
    List<AlbumVideoResponse> findVideosByAlbumId(Long albumId);
    void deleteByAlbum_Id(Long albumId);
}