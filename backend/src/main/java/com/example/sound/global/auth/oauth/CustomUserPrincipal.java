package com.example.sound.global.auth.oauth;

import com.example.sound.domain.user.entity.User;
import lombok.Getter;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.core.user.OAuth2User;

import java.util.Collection;
import java.util.Collections;
import java.util.Map;

// 로그인한 사용자 정보를 담는 객체
@Getter
public class CustomUserPrincipal implements OAuth2User {

    private final Long userId;
    private final String nickname;
    private final Map<String, Object> attributes;

    public CustomUserPrincipal(User user, Map<String, Object> attributes) {
        this.userId = user.getId();
        this.nickname = user.getNickname();
        this.attributes = attributes;
    }

    @Override
    public Map<String, Object> getAttributes() {
        return attributes;
    }

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return Collections.singletonList(new SimpleGrantedAuthority("ROLE_USER"));
    }

    @Override
    public String getName() {
        return String.valueOf(userId);
    }
}
