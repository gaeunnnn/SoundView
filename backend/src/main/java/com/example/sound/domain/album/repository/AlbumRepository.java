package com.example.sound.domain.album.repository;

import com.example.sound.domain.album.dto.AlbumResponse;
import com.example.sound.domain.album.entity.Album;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface AlbumRepository extends JpaRepository<Album, Long> {

    @Query("""
        SELECT new com.example.sound.domain.album.dto.AlbumResponse(
            a.id,
            a.name,
            a.owner.id,
            a.owner.nickname,
            CASE WHEN a.owner.id = :userId THEN true ELSE false END,
            COUNT(au2.id)
        )
        FROM AlbumUser au
        JOIN au.album a
        JOIN AlbumUser au2 ON au2.album.id = a.id
        WHERE au.user.id = :userId
        GROUP BY a.id
    """)
    List<AlbumResponse> findAlbumsByUserId(Long userId);
}