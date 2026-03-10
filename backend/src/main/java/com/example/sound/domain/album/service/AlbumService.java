package com.example.sound.domain.album.service;

import com.example.sound.domain.album.dto.AlbumResponse;
import com.example.sound.domain.album.repository.AlbumRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class AlbumService {

    private final AlbumRepository albumRepository;

    public List<AlbumResponse> getUserAlbums(Long userId) {
        return albumRepository.findAlbumsByUserId(userId);
    }
}