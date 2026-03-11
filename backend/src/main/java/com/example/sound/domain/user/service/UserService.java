package com.example.sound.domain.user.service;

import com.example.sound.domain.album.service.AlbumService;
import com.example.sound.domain.user.entity.User;
import com.example.sound.domain.user.repository.UserRepository;
import com.example.sound.global.util.UserCodeGenerator;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class UserService {

    private final UserRepository userRepository;
    private final UserCodeGenerator userCodeGenerator;
    private final AlbumService albumService;

    @Transactional
    public User findOrCreateKakaoUser(Long kakaoId, String nickname, String profileImageUrl) {
        return userRepository.findByKakaoId(kakaoId)
                .map(user -> {
                    user.updateProfile(nickname, profileImageUrl);
                    return user;
                })
                .orElseGet(() -> {

                    User newUser = userRepository.save(
                            User.builder()
                                    .kakaoId(kakaoId)
                                    .userCode(generateUniqueUserCode())
                                    .nickname(nickname)
                                    .profileImageUrl(profileImageUrl)
                                    .build()
                    );

                    // 기본 앨범 생성
                    albumService.createDefaultAlbum(newUser);

                    return newUser;
                });
    }

    public User getById(Long userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("해당 사용자가 존재하지 않습니다."));
    }

    private String generateUniqueUserCode() {
        String code;
        do {
            code = userCodeGenerator.generate();
        } while (userRepository.existsByUserCode(code));
        return code;
    }
}