package com.example.sound.domain.album.repository;

import com.example.sound.domain.album.entity.AlbumUser;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface AlbumUserRepository extends JpaRepository<AlbumUser, Long> {

    boolean existsByAlbumIdAndUserId(Long albumId, Long userId);
    Optional<AlbumUser> findByAlbumIdAndUserId(Long albumId, Long userId);
    long countByAlbumId(Long albumId);
    void deleteAllByAlbumId(Long albumId);
}