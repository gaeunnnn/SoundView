package com.example.sound.domain.album.dto;

import com.example.sound.domain.album.entity.AlbumUser;
import com.example.sound.domain.user.entity.User;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class AlbumUserResponse {

    private Long userId;
    private String nickname;
    private String userCode;
    private String profileImageUrl;
    private boolean isMe;

    public static AlbumUserResponse of(AlbumUser albumUser, Long loginUserId) {

        User user = albumUser.getUser();

        return AlbumUserResponse.builder()
                .userId(user.getId())
                .nickname(user.getNickname())
                .userCode(user.getUserCode())
                .profileImageUrl(user.getProfileImageUrl())
                .isMe(user.getId().equals(loginUserId))
                .build();
    }
}