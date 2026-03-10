package com.example.sound.domain.album.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class AlbumResponse {

    private Long albumId;
    private String name;
    private Long ownerId;
    private String ownerName;
    private boolean isOwner;
    private Long memberCount;

}