package com.example.sound.domain.auth.repository;

import com.example.sound.domain.auth.redis.RefreshToken;
import org.springframework.data.repository.CrudRepository;

public interface RefreshTokenRepository extends CrudRepository<RefreshToken, Long> {
}
