package com.example.sound.domain.album.dto;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class AlbumCreateResponse {
    private Long albumId;
    private String name;
    private int memberCount;
}
