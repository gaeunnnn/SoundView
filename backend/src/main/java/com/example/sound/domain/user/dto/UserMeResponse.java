package com.example.sound.domain.user.dto;

import com.example.sound.domain.user.entity.User;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class UserMeResponse {
    private Long id;
    private String userCode;
    private String nickname;
    private String profileImageUrl;

    public static UserMeResponse from(User user) {
        return UserMeResponse.builder()
                .id(user.getId())
                .userCode(user.getUserCode())
                .nickname(user.getNickname())
                .profileImageUrl(user.getProfileImageUrl())
                .build();
    }
}