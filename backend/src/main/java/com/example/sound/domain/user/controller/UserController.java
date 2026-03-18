package com.example.sound.domain.user.controller;

import com.example.sound.domain.user.dto.UserMeResponse;
import com.example.sound.domain.user.dto.UserSearchResponse;
import com.example.sound.domain.user.entity.User;
import com.example.sound.domain.user.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import com.example.sound.global.auth.oauth.CustomUserPrincipal;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/users")
public class UserController {

    private final UserService userService;

    // 로그인한 사용자 정보 조회
    @GetMapping("/me")
    public UserMeResponse me(
            @AuthenticationPrincipal CustomUserPrincipal principal
    ) {
        Long userId = principal.getId();

        User user = userService.getById(userId);
        return UserMeResponse.from(user);
    }

    // 친구 찾기 (userCode로 검색)
    @GetMapping("/search")
    public UserSearchResponse searchUser(@RequestParam String userCode) {
        return userService.searchUserByCode(userCode);
    }
}
