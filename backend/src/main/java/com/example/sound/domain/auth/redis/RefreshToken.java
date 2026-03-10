package com.example.sound.domain.auth.redis;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.redis.core.RedisHash;
import org.springframework.data.redis.core.TimeToLive;

@Getter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@RedisHash("refresh_token")
public class RefreshToken {

    @Id
    private Long userId;

    private String token;

    @TimeToLive
    private Long expiration;
}