package com.example.sound.domain.album.service;

import com.example.sound.domain.album.dto.AlbumResponse;
import com.example.sound.domain.album.entity.Album;
import com.example.sound.domain.album.entity.AlbumUser;
import com.example.sound.domain.album.repository.AlbumRepository;
import com.example.sound.domain.album.repository.AlbumUserRepository;
import com.example.sound.domain.user.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class AlbumService {

    private final AlbumRepository albumRepository;
    private final AlbumUserRepository albumUserRepository;

    public List<AlbumResponse> getUserAlbums(Long userId) {
        return albumRepository.findAlbumsByUserId(userId);
    }

    // 기본 앨범 생성
    public void createDefaultAlbum(User user) {

        // 1앨범 생성
        Album album = albumRepository.save(
                Album.builder()
                        .name("내 앨범")
                        .owner(user)
                        .build()
        );

        // 2앨범 멤버 추가
        AlbumUser albumUser = AlbumUser.builder()
                .album(album)
                .user(user)
                .build();

        albumUserRepository.save(albumUser);
    }
}