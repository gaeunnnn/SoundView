package com.example.sound.domain.notification.service;

import com.example.sound.domain.notification.dto.NotificationResponse;
import com.example.sound.domain.notification.repository.EmitterRepository;
import com.example.sound.domain.notification.repository.NotificationRepository;
import com.example.sound.domain.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import com.example.sound.domain.notification.entity.Notification;
import com.example.sound.domain.notification.entity.NotificationType;
import com.example.sound.domain.user.entity.User;

import java.io.IOException;
import java.util.List;
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

    public void notifyAlbumInvite(Long userId, Long albumId, String albumName, String inviterName){

        User user = userRepository.findById(userId).orElseThrow();

        Notification notification = Notification.builder()
                .user(user)
                .type(NotificationType.ALBUM_INVITE)
                .message(inviterName + "님이 공유 앨범에 초대했습니다")
                .targetId(albumId)
                .build();

        notificationRepository.save(notification);

        sendAlbumInvite(userId, albumId, albumName, inviterName);
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

    public void notifyAlbumVideoAdded(Long userId, Long albumId, String albumName, String uploaderName){

        User user = userRepository.findById(userId).orElseThrow();

        Notification notification = Notification.builder()
                .user(user)
                .type(NotificationType.ALBUM_VIDEO_ADDED)
                .message(uploaderName + "님이 영상을 추가했습니다")
                .targetId(albumId)
                .build();

        notificationRepository.save(notification);

        sendAlbumVideoAdded(userId, albumId, albumName, uploaderName);
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

    public void notifyVideoComment(Long userId, Long videoId, String commenterName){

        User user = userRepository.findById(userId).orElseThrow();

        Notification notification = Notification.builder()
                .user(user)
                .type(NotificationType.VIDEO_COMMENT)
                .message(commenterName + "님이 댓글을 남겼습니다")
                .targetId(videoId)
                .build();

        notificationRepository.save(notification);

        sendVideoComment(userId, videoId, commenterName);
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

    // 알림 목록 조회
    @Transactional
    public List<NotificationResponse> getNotifications(Long userId) {
        return notificationRepository
                .findByUserIdOrderByCreatedAtDesc(userId)
                .stream()
                .map(NotificationResponse::from)
                .toList();
    }

    // 읽지 않은 알림 개수
    @Transactional
    public long getUnreadCount(Long userId) {
        return notificationRepository.countByUserIdAndIsReadFalse(userId);
    }

    // 읽음 처리
    @Transactional
    public void readNotification(Long notificationId){

        Notification notification = notificationRepository.findById(notificationId)
                .orElseThrow(() -> new RuntimeException("알림 없음"));

        notification.markAsRead();
    }

    public void sendVideoCompleted(Long userId, Long videoId){

        SseEmitter emitter = emitterRepository.get(userId);

        if(emitter == null) return;

        try{
            emitter.send(
                    SseEmitter.event()
                            .name("VIDEO_COMPLETED")
                            .data(Map.of(
                                    "videoId", videoId,
                                    "status", "COMPLETED"
                            ))
            );
        } catch (IOException e){
            emitterRepository.delete(userId);
        }
    }

    public void notifyVideoCompleted(Long userId, Long videoId){

        User user = userRepository.findById(userId).orElseThrow();

        Notification notification = Notification.builder()
                .user(user)
                .type(NotificationType.VIDEO_COMPLETED)
                .message("영상 처리가 완료되었습니다")
                .targetId(videoId)
                .build();

        notificationRepository.save(notification);

        sendVideoCompleted(userId, videoId);
    }
}
