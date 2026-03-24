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
        COUNT(au.id)
    )
    FROM Album a
    JOIN AlbumUser au ON au.album.id = a.id
    WHERE a.id IN (
        SELECT au2.album.id
        FROM AlbumUser au2
        WHERE au2.user.id = :userId
    )
    GROUP BY a.id, a.name, a.owner.id, a.owner.nickname
""")
    List<AlbumResponse> findAlbumsByUserId(Long userId);

    java.util.Optional<com.example.sound.domain.album.entity.Album> findByOwnerIdAndName(Long ownerId, String name);
}