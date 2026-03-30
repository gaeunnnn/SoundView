package com.example.sound.domain.auth.service;

import com.example.sound.domain.auth.redis.RefreshToken;
import com.example.sound.domain.auth.repository.RefreshTokenRepository;
import org.springframework.transaction.annotation.Transactional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class RefreshTokenService {

    private  final RefreshTokenRepository refreshTokenRepository;

    @Transactional
    public void save(Long userId, String token, Long expiration) {
        RefreshToken refreshToken = RefreshToken.builder()
                .userId(userId)
                .token(token)
                .expiration(expiration)
                .build();

        refreshTokenRepository.save(refreshToken);
    }

    public RefreshToken getByUserId(Long userId) {
        return refreshTokenRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("리프레시 토큰이 존재하지 않습니다."));
    }

    @Transactional
    public void delete(Long userId){
        refreshTokenRepository.deleteById(userId);
    }
}
