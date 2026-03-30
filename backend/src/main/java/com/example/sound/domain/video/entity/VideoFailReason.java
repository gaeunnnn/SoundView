package com.example.sound.domain.video.entity;

public enum VideoFailReason {

    UPLOAD_FAILED,         // 클라이언트 업로드 실패
    FILE_DOWNLOAD_FAIL,    // 스토리지에서 영상 못 가져옴
    FILE_UPLOAD_FAIL,      // 결과 파일 업로드 실패
    AI_PROCESS_FAILED,     // AI 처리 실패
    TIMEOUT,               // 처리 시간 초과
    UNKNOWN
}
