package com.example.sound.domain.album.dto;

import lombok.Getter;

import java.util.List;

@Getter
public class AlbumVideoAddRequest {

    private List<Long> videoIds;
}
