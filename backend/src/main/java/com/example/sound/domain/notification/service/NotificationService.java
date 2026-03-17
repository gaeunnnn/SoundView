package com.example.sound.domain.notification.service;

import com.example.sound.domain.notification.repository.EmitterRepository;
import com.example.sound.domain.notification.repository.NotificationRepository;
import com.example.sound.domain.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
@RequiredArgsConstructor
public class NotificationService {

    private final EmitterRepository emitterRepository;
    private final NotificationRepository notificationRepository;
    private final UserRepository userRepository;

    private static final Long DEFAULT_TIMEOUT = 60L * 60 * 1000; // 1시간

    // sse 구독
    public SseEmitter subscribe(Long userId) {
        SseEmitter emitter = new SseEmitter(DEFAULT_TIMEOUT);

        emitterRepository.save(userId, emitter);

        emitter.onCompletion(() -> emitterRepository.delete(userId));
        emitter.onTimeout(() -> emitterRepository.delete(userId));

        try{
            emitter.send(
                    SseEmitter.event()
                            .name("CONNECT")
                            .data("connected")
            );
        } catch (IOException e){
            emitterRepository.delete(userId);
        }

        return emitter;
    }

    // 공유 앨범 초대 알림
    public void sendAlbumInvite(Long userId, Long albumId, String albumName, String inviterName){

        SseEmitter emitter = emitterRepository.get(userId);

        if(emitter == null) return;

        try {
            emitter.send(
                    SseEmitter.event()
                            .name("ALBUM_INVITE")
                            .data(Map.of(
                                    "albumId",albumId,
                                    "albumName",albumName,
                                    "inviterName", inviterName
                            ))
            );
        } catch (IOException e) {
            emitterRepository.delete(userId);
        }
    }

    // 공유 앨범 영상 추가 알림
    public void sendAlbumVideoAdded(Long userId, Long albumId, String albumName, String uploaderName){

        SseEmitter emitter = emitterRepository.get(userId);

        if(emitter == null) return;

        try{

            emitter.send(
                    SseEmitter.event()
                            .name("ALBUM_VIDEO_ADDED")
                            .data(Map.of(
                                    "albumId", albumId,
                                    "albumName", albumName,
                                    "uploaderName", uploaderName
                            ))
            );

        }catch (IOException e){
            emitterRepository.delete(userId);
        }
    }

    // 댓글 알림
    public void sendVideoComment(Long userId, Long videoId, String commenterName){

        SseEmitter emitter = emitterRepository.get(userId);

        if(emitter == null) return;

        try{

            emitter.send(
                    SseEmitter.event()
                            .name("VIDEO_COMMENT")
                            .data(Map.of(
                                    "videoId", videoId,
                                    "commenterName", commenterName
                            ))
            );

        }catch (IOException e){
            emitterRepository.delete(userId);
        }
    }

    // Heartbeat (연결 유지)
    @Scheduled(fixedRate = 30000)
    public void heartbeat(){

        emitterRepository.emitters().forEach((userId,emitter) ->{
            try{
                emitter.send(
                        SseEmitter.event()
                                .name("PING")
                                .data("keepalive")
                );
            } catch (IOException e) {
                emitterRepository.delete(userId);
            }
        });
    }
}
