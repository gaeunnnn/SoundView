package com.example.sound.domain.album.repository;

import com.example.sound.domain.album.entity.AlbumUser;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface AlbumUserRepository extends JpaRepository<AlbumUser, Long> {

    boolean existsByAlbumIdAndUserId(Long albumId, Long userId);
    Optional<AlbumUser> findByAlbumIdAndUserId(Long albumId, Long userId);
    long countByAlbumId(Long albumId);
    void deleteAllByAlbumId(Long albumId);

    @Query("""
        select au
        from AlbumUser au
        join fetch au.user
        where au.album.id = :albumId
    """)
    List<AlbumUser> findUsersByAlbumId(Long albumId);
}