package com.example.sound.domain.album.service;

import com.example.sound.domain.album.dto.AlbumVideoResponse;
import com.example.sound.domain.album.repository.AlbumUserRepository;
import com.example.sound.domain.album.repository.AlbumVideoRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.security.access.AccessDeniedException;
import java.util.List;

@Service
@RequiredArgsConstructor
public class AlbumVideoService {

    private final AlbumVideoRepository albumVideoRepository;
    private final AlbumUserRepository albumUserRepository;

    public List<AlbumVideoResponse> getAlbumVideos(Long albumId, Long userId) {

        if (!albumUserRepository.existsByAlbumIdAndUserId(albumId, userId)) {
            throw new AccessDeniedException("앨범 접근 권한이 없습니다.");
        }

        return albumVideoRepository.findVideosByAlbumId(albumId);
    }
}