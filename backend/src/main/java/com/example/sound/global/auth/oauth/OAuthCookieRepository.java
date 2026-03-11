package com.example.sound.global.auth.oauth;

import com.example.sound.global.util.CookieUtil;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.security.oauth2.client.web.AuthorizationRequestRepository;
import org.springframework.security.oauth2.core.endpoint.OAuth2AuthorizationRequest;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

/**
 * [동적 리다이렉트 보관소]
 * 사용자가 카카오 로그인을 시작할 때, 프론트엔드가 보낸 '돌아올 주소'를
 * 쿠키(주머니)에 잠시 보관하는 역할을 합니다.
 */
@Component
@RequiredArgsConstructor
public class OAuthCookieRepository implements AuthorizationRequestRepository<OAuth2AuthorizationRequest> {

    public static final String OAUTH_AUTH_REQUEST = "oauth_auth_request"; // 시큐리티 인증용
    public static final String REDIRECT_URI_PARAM = "redirect_uri";       // 우리 목표 주소용
    private static final int COOKIE_EXPIRE_SECONDS = 180;               // 3분 유효

    private final CookieUtil cookieUtil;

    // 1. [로그인 시작 시] : 주소를 쿠키 주머니에 넣습니다.
    @Override
    public void saveAuthorizationRequest(OAuth2AuthorizationRequest authReq, HttpServletRequest req, HttpServletResponse res) {
        if (authReq == null) {
            cookieUtil.deleteCookie(res, OAUTH_AUTH_REQUEST);
            cookieUtil.deleteCookie(res, REDIRECT_URI_PARAM);
            return;
        }

        // 인증 정보 쿠키에 굽기 (시큐리티 필수)
        cookieUtil.addCookie(res, OAUTH_AUTH_REQUEST, cookieUtil.serialize(authReq), COOKIE_EXPIRE_SECONDS);

        // 프론트가 보낸 돌아올 주소(?redirect_uri=...)를 쿠키에 따로 굽기!
        String targetUrl = req.getParameter(REDIRECT_URI_PARAM);
        if (StringUtils.hasText(targetUrl)) {
            cookieUtil.addCookie(res, REDIRECT_URI_PARAM, targetUrl, COOKIE_EXPIRE_SECONDS);
        }
    }

    // 2. [로그인 중간 시] : 쿠키 주머니에서 정보를 꺼냅니다.
    @Override
    public OAuth2AuthorizationRequest loadAuthorizationRequest(HttpServletRequest request) {
        return cookieUtil.getCookie(request, OAUTH_AUTH_REQUEST)
                .map(cookie -> cookieUtil.deserialize(cookie, OAuth2AuthorizationRequest.class))
                .orElse(null);
    }

    // 3. [완료 후] : 주머니를 비웁니다.
    @Override
    public OAuth2AuthorizationRequest removeAuthorizationRequest(HttpServletRequest req, HttpServletResponse res) {
        return this.loadAuthorizationRequest(req);
    }

    public void clear(HttpServletRequest request, HttpServletResponse response) {
        cookieUtil.deleteCookie(response, OAUTH_AUTH_REQUEST);
        cookieUtil.deleteCookie(response, REDIRECT_URI_PARAM);
    }
}
