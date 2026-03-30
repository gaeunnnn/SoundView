package com.example.sound.domain.auth.service;

import com.example.sound.domain.auth.redis.RefreshToken;
import com.example.sound.global.auth.jwt.JwtTokenProvider;
import com.example.sound.global.util.CookieUtil;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class AuthService {

    private final JwtTokenProvider jwtTokenProvider;
    private final RefreshTokenService refreshTokenService;
    private final CookieUtil cookieUtil;

    @Value("${jwt.refresh-token-expiration}")
    private long refreshTokenExpiration;

    @Transactional
    public void reissue(HttpServletRequest request, HttpServletResponse response) {
        String refreshToken = cookieUtil.getCookieValue(request, "refresh_token");

        if (refreshToken == null || !jwtTokenProvider.validateToken(refreshToken)) {
            throw new IllegalArgumentException("유효하지 않은 리프레시 토큰입니다.");
        }

        if (!"refresh".equals(jwtTokenProvider.getTokenType(refreshToken))) {
            throw new IllegalArgumentException("리프레시 토큰 타입이 아닙니다.");
        }

        Long userId = jwtTokenProvider.getUserId(refreshToken);

        RefreshToken savedRefreshToken = refreshTokenService.getByUserId(userId);

        if (!savedRefreshToken.getToken().equals(refreshToken)) {
            throw new IllegalArgumentException("저장된 리프레시 토큰과 일치하지 않습니다.");
        }

        String newAccessToken = jwtTokenProvider.createAccessToken(userId);
        String newRefreshToken = jwtTokenProvider.createRefreshToken(userId);

        refreshTokenService.save(userId, newRefreshToken, refreshTokenExpiration / 1000);

        cookieUtil.addCookie(response, "access_token", newAccessToken, 60 * 30);
        cookieUtil.addCookie(response, "refresh_token", newRefreshToken, 60 * 60 * 24 * 14);
    }

    @Transactional
    public void logout(HttpServletRequest request, HttpServletResponse response) {
        String refreshToken = cookieUtil.getCookieValue(request, "refresh_token");

        if (refreshToken != null && jwtTokenProvider.validateToken(refreshToken)) {
            Long userId = jwtTokenProvider.getUserId(refreshToken);
            refreshTokenService.delete(userId);
        }

        cookieUtil.deleteCookie(response, "access_token");
        cookieUtil.deleteCookie(response, "refresh_token");
    }
}
