package com.example.sound.domain.user.dto;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class UserSearchResponse {
    private Long userId;
    private String nickname;
    private String profileImageUrl;
    private String userCode;
}
