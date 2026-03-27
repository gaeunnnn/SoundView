// 알림 관련 API 함수를 모아두는 파일

import { apiClient } from "./client";

const BASE_URL = import.meta.env.VITE_API_BASE_URL;

export type Notification = {
  id: number;
  type: "ALBUM_INVITE" | "ALBUM_VIDEO_ADDED" | "VIDEO_COMMENT" | "VIDEO_COMPLETED" | string;
  message: string;
  isRead: boolean; // 프론트 내부 필드 (서버 응답의 read를 매핑)
  read?: boolean;  // 서버 응답 필드
  createdAt: string;
  // SSE 이벤트에서 추출한 관련 ID (알림 목록 API에는 없으므로 SSE 수신 시 프론트에서 세팅)
  albumId?: number;   // ALBUM_INVITE, ALBUM_VIDEO_ADDED
  videoId?: number;   // VIDEO_COMMENT, VIDEO_COMPLETED
  albumVideoId?: number; // VIDEO_COMPLETED 수신 시 세팅
};

// GET /api/notifications — 알림 목록 최신순 조회
export const getNotifications = (): Promise<Notification[]> =>
  apiClient.get<Notification[]>("/api/notifications").then((res) =>
    res.data.map((n) => ({ ...n, isRead: n.isRead ?? n.read ?? false }))
  );

// GET /api/notifications/unread-count — 읽지 않은 알림 개수 조회
export const getUnreadCount = (): Promise<number> =>
  apiClient.get<{ count: number }>("/api/notifications/unread-count").then((res) => res.data.count);

// PATCH /api/notifications/{id}/read — 특정 알림 읽음 처리
export const markNotificationRead = (id: number): Promise<void> =>
  apiClient.patch(`/api/notifications/${id}/read`).then(() => {});

type SseHandlers = {
  onNotification?: (n: Notification) => void;
  onVideoCompleted?: (videoId: number, albumVideoId?: number) => void;
};

// GET /api/notifications/subscribe — SSE 실시간 알림 구독, 반환값은 구독 해제 함수
export const subscribeNotifications = ({ onNotification, onVideoCompleted }: SseHandlers): () => void => {
  const es = new EventSource(`${BASE_URL}/api/notifications/subscribe`, { withCredentials: true });

  es.addEventListener("ALBUM_INVITE", (e) => {
    try {
      const data = JSON.parse((e as MessageEvent).data) as { albumId: number; albumName: string; inviterName: string };
      onNotification?.({ id: Date.now(), type: "ALBUM_INVITE", message: `${data.inviterName}님이 '${data.albumName}' 앨범에 초대했습니다.`, isRead: false, createdAt: new Date().toISOString(), albumId: data.albumId });
    } catch {}
  });

  es.addEventListener("ALBUM_VIDEO_ADDED", (e) => {
    try {
      const data = JSON.parse((e as MessageEvent).data) as { albumId: number; albumName: string; uploaderName: string };
      onNotification?.({ id: Date.now(), type: "ALBUM_VIDEO_ADDED", message: `${data.uploaderName}님이 '${data.albumName}'에 영상을 추가했습니다.`, isRead: false, createdAt: new Date().toISOString(), albumId: data.albumId });
    } catch {}
  });

  es.addEventListener("VIDEO_COMMENT", (e) => {
    try {
      const data = JSON.parse((e as MessageEvent).data) as { videoId: number; commenterName: string };
      onNotification?.({ id: Date.now(), type: "VIDEO_COMMENT", message: `${data.commenterName}님이 댓글을 남겼습니다.`, isRead: false, createdAt: new Date().toISOString(), videoId: data.videoId });
    } catch {}
  });

  es.addEventListener("VIDEO_COMPLETED", (e) => {
    try {
      const data = JSON.parse((e as MessageEvent).data) as { videoId: number; albumVideoId?: number; status: string };
      if (data.status === "COMPLETED") onVideoCompleted?.(data.videoId, data.albumVideoId);
    } catch {}
  });

  es.onerror = () => es.close();
  return () => es.close();
};
