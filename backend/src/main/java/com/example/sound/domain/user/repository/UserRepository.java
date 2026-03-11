package com.example.sound.domain.user.repository;

import com.example.sound.domain.user.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByKakaoId(Long kakaoId);
    boolean existsByUserCode(String userCode);
    Optional<User> findByUserCode(String userCode);
}