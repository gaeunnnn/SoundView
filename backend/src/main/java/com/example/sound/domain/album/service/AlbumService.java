package com.example.sound.domain.album.service;

import com.example.sound.domain.album.dto.AlbumCreateRequest;
import com.example.sound.domain.album.dto.AlbumCreateResponse;
import com.example.sound.domain.album.dto.AlbumResponse;
import com.example.sound.domain.album.entity.Album;
import com.example.sound.domain.album.entity.AlbumUser;
import com.example.sound.domain.album.repository.AlbumRepository;
import com.example.sound.domain.album.repository.AlbumUserRepository;
import com.example.sound.domain.user.entity.User;
import com.example.sound.domain.user.repository.UserRepository;
import com.example.sound.domain.user.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
public class AlbumService {

    private final AlbumRepository albumRepository;
    private final AlbumUserRepository albumUserRepository;
    private final UserRepository userRepository;

    public List<AlbumResponse> getUserAlbums(Long userId) {
        return albumRepository.findAlbumsByUserId(userId);
    }

    // 기본 앨범 생성
    public void createDefaultAlbum(User user) {

        // 1.앨범 생성
        Album album = albumRepository.save(
                Album.builder()
                        .name("내 앨범")
                        .owner(user)
                        .build()
        );

        // 2.앨범 멤버 추가
        AlbumUser albumUser = AlbumUser.builder()
                .album(album)
                .user(user)
                .build();

        albumUserRepository.save(albumUser);
    }

    @Transactional
    public AlbumCreateResponse createAlbum(Long loginUserId, AlbumCreateRequest request){

        User owner = userRepository.findById(loginUserId)
                .orElseThrow(() -> new IllegalArgumentException("사용자 없음"));

        Album album = albumRepository.save(
                Album.builder()
                        .name(request.getName())
                        .owner(owner)
                        .build()
        );

        List<User> members = new ArrayList<>();
        members.add(owner);

        for(String code : request.getMemberCodes()){

            User user = userRepository.findByUserCode(code)
                    .orElseThrow(() -> new IllegalArgumentException("사용자 없음"));
            members.add(user);
        }

        for (User member : members){
            AlbumUser albumUser = AlbumUser.builder()
                    .album(album)
                    .user(member)
                    .build();

            albumUserRepository.save(albumUser);
        }

        return AlbumCreateResponse.builder()
                .albumId(album.getId())
                .name(album.getName())
                .memberCount(members.size())
                .build();
    }
}