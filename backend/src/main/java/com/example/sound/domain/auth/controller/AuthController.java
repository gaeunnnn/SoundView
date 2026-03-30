package com.example.sound.domain.auth.controller;

import com.example.sound.domain.auth.service.AuthService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
@Tag(name = "Auth", description = "인증 및 토큰 관련 API")
public class AuthController {

    private final AuthService authService;

    @Operation(summary = "토큰 재발급")
    @PostMapping("/api/auth/reissue")
    public String reissue(HttpServletRequest request, HttpServletResponse response){
        authService.reissue(request , response);
        return "토큰 재발급 완료";
    }

    @Operation(summary = "로그아웃")
    @PostMapping("/api/auth/logout")
    public String logout(HttpServletRequest request, HttpServletResponse response){
        authService.logout(request, response);
        return "로그아웃 완료";
    }
}
