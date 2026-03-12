package com.example.sound.domain.album.service;

import com.example.sound.domain.album.dto.*;
import com.example.sound.domain.album.entity.Album;
import com.example.sound.domain.album.entity.AlbumUser;
import com.example.sound.domain.album.repository.AlbumRepository;
import com.example.sound.domain.album.repository.AlbumUserRepository;
import com.example.sound.domain.album.repository.AlbumVideoRepository;
import com.example.sound.domain.user.entity.User;
import com.example.sound.domain.user.repository.UserRepository;
import com.example.sound.domain.video.repository.VideoCommentRepository;
import com.example.sound.domain.video.repository.VideoReactionRepository;
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
    private final VideoReactionRepository videoReactionRepository;
    private final VideoCommentRepository videoCommentRepository;
    private final AlbumVideoRepository albumVideoRepository;

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

    @Transactional
    public void leaveAlbum(Long albumId, Long userId) {

        AlbumUser albumUser = albumUserRepository
                .findByAlbumIdAndUserId(albumId,userId)
                .orElseThrow(() -> new IllegalArgumentException("앨범 멤버가 아닙니다."));

        albumUserRepository.delete(albumUser);

        long memberCount = albumUserRepository.countByAlbumId(albumId);

        if(memberCount == 0){

            videoReactionRepository.deleteByAlbumId(albumId);
            videoCommentRepository.deleteByAlbumId(albumId);

            albumVideoRepository.deleteByAlbum_Id(albumId);

            // albumUser 정리
            albumUserRepository.deleteAllByAlbumId(albumId);

            albumRepository.deleteById(albumId);
        }
    }

    @Transactional
    public AlbumUpdateResponse updateAlbum(Long albumId, Long userId, AlbumUpdateRequest request){

        Album album = albumRepository.findById(albumId)
                .orElseThrow(() -> new IllegalArgumentException("앨범이 존재하지 않습니다."));

        // 내 앨범 수정 금지
        if(album.getName().equals("내 앨범")){
            throw new IllegalArgumentException("내 앨범은 이름을 수정할 수 없습니다.");
        }

        // 앨범 멤버인지 확인
        albumUserRepository.findByAlbumIdAndUserId(albumId, userId)
                .orElseThrow(() -> new IllegalArgumentException("앨범 멤버가 아닙니다."));

        album.updateName(request.getName());

        return AlbumUpdateResponse.builder()
                .albumId(album.getId())
                .name(album.getName())
                .build();
    }
}