package com.example.sound.domain.auth.controller;

import com.example.sound.domain.auth.service.AuthService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    @PostMapping("/api/auth/reissue")
    public String reissue(HttpServletRequest request, HttpServletResponse response){
        authService.reissue(request , response);
        return "토큰 재발급 완료";
    }

    @PostMapping("/api/auth/logout")
    public String logout(HttpServletRequest request, HttpServletResponse response){
        authService.logout(request, response);
        return "로그아웃 완료";
    }
}
