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

    @Column(name = "video_s3_key", length = 500)
    private String videoS3Key;

    @Column(name = "thumbnail_s3_key", length = 500)
    private String thumbnailS3Key;

    @Column(name = "duration_sec", precision = 10, scale = 3)
    private BigDecimal durationSec;

    @Column(name = "subtitle_s3_key", length = 500)
    private String subtitleS3Key;

    @Column(name = "vibration_s3_key", length = 500)
    private String vibrationS3Key;

    @Column(name = "upload_id", length = 255)
    private String uploadId;

    @Column(name = "original_file_name", length = 255)
    private String originalFileName;

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

    public void updateVideoS3Key(String videoS3Key){
        this.videoS3Key = videoS3Key;
    }

    // 업로드 완료 → AI 처리 시작
    public void markProcessing() {
        this.status = VideoStatus.PROCESSING;
    }

    // AI 처리 완료 → 결과 S3 Key 저장
    public void markCompleted(String subtitleS3Key) {
        if (subtitleS3Key == null) {
            throw new IllegalArgumentException("결과 없이 완료 불가");
        }

        this.status = VideoStatus.COMPLETED;
        this.subtitleS3Key = subtitleS3Key;
    }

    // 처리 실패 → 상태 + 원인 저장
    public void markFailed(VideoFailReason reason) {
        this.status = VideoStatus.FAILED;
        this.failReason = reason;
        this.subtitleS3Key = null; // 혹시 남아있던 값 제거
    }

    // 멀티파트 세션 정보 저장
    public void setUploadId(String uploadId, String originalFileName) {
        this.uploadId = uploadId;
        this.originalFileName = originalFileName;
    }
}