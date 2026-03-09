package com.example.sound.domain.user.controller;

import com.example.sound.domain.user.dto.UserMeResponse;
import com.example.sound.domain.user.entity.User;
import com.example.sound.domain.user.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    @GetMapping("/api/users/me")
    public UserMeResponse me(Authentication authentication) {

        Long userId = (Long) authentication.getPrincipal();

        User user = userService.getById(userId);

        return UserMeResponse.from(user);
    }
}
