package com.example.sound.domain.album.controller;

import com.example.sound.domain.album.dto.AlbumResponse;
import com.example.sound.domain.album.service.AlbumService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/albums")
@RequiredArgsConstructor
@Tag(name = "Album", description = "앨범 API")
public class AlbumController {

    private final AlbumService albumService;

    @Operation(summary = "앨범 목록 조회", description = "사용자가 속한 앨범 목록을 조회합니다.")
    @GetMapping
    public List<AlbumResponse> getAlbums(@RequestParam Long userId) {
        return albumService.getUserAlbums(userId);
    }
}