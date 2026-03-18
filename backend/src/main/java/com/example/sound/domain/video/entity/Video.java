package com.example.sound.domain.video.entity;

import com.example.sound.domain.user.entity.User;
import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "videos")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder
public class Video {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // 업로더
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "uploader_id", nullable = false)
    private User uploader;

    @Column(nullable = false, length = 255)
    private String title;

    @Column(name = "video_url", length = 500)
    private String videoUrl;

    @Column(name = "thumbnail_url", length = 500)
    private String thumbnailUrl;

    @Column(name = "duration_sec", precision = 10, scale = 3)
    private BigDecimal durationSec;

    @Column(name = "subtitle_file_url", length = 500)
    private String subtitleFileUrl;

    @Column(name = "vibration_file_url", length = 500)
    private String vibrationFileUrl;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private VideoStatus status;

    @Enumerated(EnumType.STRING)
    @Column(name = "fail_reason", length = 50)
    private VideoFailReason failReason;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    public void prePersist() {
        LocalDateTime now = LocalDateTime.now();
        this.createdAt = now;
        this.updatedAt = now;

        // status가 없으면 기본값 PENDING
        if (this.status == null) {
            this.status = VideoStatus.PENDING;
        }
    }

    @PreUpdate
    public void preUpdate() {
        this.updatedAt = LocalDateTime.now();
    }

    public void updateTitle(String title){
        this.title = title;
    }

    public void updateVideoUrl(String videoUrl){
        this.videoUrl = videoUrl;
    }

    // 업로드 완료 → AI 처리 시작
    public void markProcessing() {
        this.status = VideoStatus.PROCESSING;
    }

    // AI 처리 완료 → 결과 URL 저장
    public void markCompleted(String subtitleUrl) {
        if (subtitleUrl == null) {
            throw new IllegalArgumentException("결과 없이 완료 불가");
        }

        this.status = VideoStatus.COMPLETED;
        this.subtitleFileUrl = subtitleUrl;
    }

    // 처리 실패 → 상태 + 원인 저장
    public void markFailed(VideoFailReason reason) {
        this.status = VideoStatus.FAILED;
        this.failReason = reason;
        this.subtitleFileUrl = null; // 혹시 남아있던 값 제거
    }
}