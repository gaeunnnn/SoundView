package com.example.sound.domain.album.repository;

import com.example.sound.domain.album.entity.AlbumUser;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AlbumUserRepository extends JpaRepository<AlbumUser, Long> {

    boolean existsByAlbumIdAndUserId(Long albumId, Long userId);
}