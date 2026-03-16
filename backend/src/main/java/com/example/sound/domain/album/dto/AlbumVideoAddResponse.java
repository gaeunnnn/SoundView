package com.example.sound.domain.album.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;

import java.util.List;

@Getter
@AllArgsConstructor
public class AlbumVideoAddResponse {

    private List<Long> albumVideoIds;

}