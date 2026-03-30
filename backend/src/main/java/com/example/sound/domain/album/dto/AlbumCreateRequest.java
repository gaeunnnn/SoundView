package com.example.sound.domain.album.dto;

import lombok.Getter;

import java.util.List;

@Getter
public class AlbumCreateRequest {
    private String name;
    private List<String> memberCodes;
}
