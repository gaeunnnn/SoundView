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
import java.net.URI;
import java.util.List;

@Component
@RequiredArgsConstructor
public class OAuth2SuccessHandler extends SimpleUrlAuthenticationSuccessHandler {

    private final JwtTokenProvider jwtTokenProvider;
    private final RefreshTokenService refreshTokenService;
    private final CookieUtil cookieUtil;
    private final OAuthCookieRepository oAuthCookieRepository;

    @Value("${jwt.refresh-token-expiration}")
    private long refreshTokenExpiration;

    @Value("${app.frontend-url}")
    private String frontendUrl;

    // application.yml에 등록된 허용된 리다이렉트 주소들 (ALLOWED_ORIGINS)
    @Value("${app.authorized-redirect-uris}")
    private List<String> authorizedUris;

    @Override
    public void onAuthenticationSuccess(HttpServletRequest request,
                                        HttpServletResponse response,
                                        Authentication authentication) throws IOException, ServletException {

        // 1. [사용자 정보 및 토큰 생성] : 기존 로직
        CustomUserPrincipal customUserPrincipal = (CustomUserPrincipal) authentication.getPrincipal();
        Long userId = customUserPrincipal.getUserId();

        String accessToken = jwtTokenProvider.createAccessToken(userId);
        String refreshToken = jwtTokenProvider.createRefreshToken(userId);

        // 2. [Redis 저장 및 쿠키 저장] : 기존 로직 (충돌 없음)
        refreshTokenService.save(userId, refreshToken, refreshTokenExpiration / 1000);
        cookieUtil.addCookie(response, "access_token", accessToken, 60 * 30);
        cookieUtil.addCookie(response, "refresh_token", refreshToken, 60 * 60 * 24 * 14);

        // 3. [리다이렉트 주소 찾기]
        String targetUrl = cookieUtil.getCookie(request, OAuthCookieRepository.REDIRECT_URI_PARAM)
                .map(Cookie::getValue)
                .orElse(frontendUrl);

        // 4. [보안 검증] : 허용된 주소인지 확인 (중요!)
        if (!isAuthorizedUri(targetUrl)) {
            throw new RuntimeException("허용되지 않은 리다이렉트 주소입니다: " + targetUrl);
        }

        // 5. [정리 및 이동]
        oAuthCookieRepository.clear(request, response);
        getRedirectStrategy().sendRedirect(request, response, targetUrl);
    }

    // 주소의 도메인(Host)과 포트가 허용 리스트에 있는지 확인합니다.
    private boolean isAuthorizedUri(String uri) {
        URI clientUri = URI.create(uri);
        return authorizedUris.stream().anyMatch(allowed -> {
            URI allowedUri = URI.create(allowed);
            return allowedUri.getHost().equalsIgnoreCase(clientUri.getHost()) &&
                   allowedUri.getPort() == clientUri.getPort();
        });
    }
}
