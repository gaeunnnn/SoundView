// 알림 관련 API 함수를 모아두는 파일

import { apiClient } from "./client";

const BASE_URL = import.meta.env.VITE_API_BASE_URL;

export type Notification = {
  id: number;
  type: "ALBUM_INVITE" | "ALBUM_VIDEO_ADDED" | "VIDEO_COMMENT" | string;
  message: string;
  isRead: boolean; // 프론트 내부 필드 (서버 응답의 read를 매핑)
  read?: boolean;  // 서버 응답 필드
  createdAt: string;
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

  const notifyEvents = ["ALBUM_INVITE", "ALBUM_VIDEO_ADDED", "VIDEO_COMMENT"] as const;
  notifyEvents.forEach((type) => {
    es.addEventListener(type, (e) => {
      try { onNotification?.(JSON.parse((e as MessageEvent).data)); } catch {}
    });
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
