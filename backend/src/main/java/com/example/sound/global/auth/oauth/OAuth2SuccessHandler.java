package com.example.sound.global.auth.oauth;

import com.example.sound.domain.auth.service.RefreshTokenService;
import com.example.sound.global.auth.jwt.JwtTokenProvider;
import com.example.sound.global.util.CookieUtil;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.Authentication;
import org.springframework.security.web.authentication.SimpleUrlAuthenticationSuccessHandler;
import org.springframework.stereotype.Component;

import java.io.IOException;

@Component
@RequiredArgsConstructor
public class OAuth2SuccessHandler extends SimpleUrlAuthenticationSuccessHandler {

    private final JwtTokenProvider jwtTokenProvider;
    private final RefreshTokenService refreshTokenService;
    private final CookieUtil cookieUtil;

    @Value("${jwt.refresh-token-expiration}")
    private long refreshTokenExpiration;

    @Value("${app.frontend-url}")
    private String frontendUrl;

    @Override
    public void onAuthenticationSuccess(HttpServletRequest request,
                                        HttpServletResponse response,
                                        Authentication authentication) throws IOException, ServletException{

        CustomUserPrincipal customUserPrincipal  = (CustomUserPrincipal) authentication.getPrincipal();

        Long userId = customUserPrincipal.getUserId();

        String accessToken = jwtTokenProvider.createAccessToken(userId);
        String refreshToken = jwtTokenProvider.createRefreshToken(userId);

        refreshTokenService.save(userId,refreshToken,refreshTokenExpiration/1000);

        cookieUtil.addCookie(response,"access_token", accessToken, 60*30);
        cookieUtil.addCookie(response,"refresh_token", refreshToken, 60*60*24*14);

        response.sendRedirect(frontendUrl);
    }
}
