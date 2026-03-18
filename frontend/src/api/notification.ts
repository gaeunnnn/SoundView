// 알림 관련 API 함수를 모아두는 파일

import { apiClient } from "./client";

const BASE_URL = import.meta.env.VITE_API_BASE_URL;

export type Notification = {
  id: number;
  type: "ALBUM_INVITE" | "ALBUM_VIDEO_ADDED" | "VIDEO_COMMENT" | string;
  message: string;
  isRead: boolean;
  createdAt: string;
};

// GET /api/notifications — 알림 목록 최신순 조회
export const getNotifications = (): Promise<Notification[]> =>
  apiClient.get<Notification[]>("/api/notifications").then((res) => res.data);

// GET /api/notifications/unread-count — 읽지 않은 알림 개수 조회
export const getUnreadCount = (): Promise<number> =>
  apiClient.get<{ count: number }>("/api/notifications/unread-count").then((res) => res.data.count);

// PATCH /api/notifications/{id}/read — 특정 알림 읽음 처리
export const markNotificationRead = (id: number): Promise<void> =>
  apiClient.patch(`/api/notifications/${id}/read`).then(() => {});

// GET /api/notifications/subscribe — SSE 실시간 알림 구독, 반환값은 구독 해제 함수
export const subscribeNotifications = (onNotification: (n: Notification) => void): () => void => {
  const es = new EventSource(`${BASE_URL}/api/notifications/subscribe`, { withCredentials: true });
  es.onmessage = (e) => {
    try {
      const data = JSON.parse(e.data) as Notification;
      onNotification(data);
    } catch {
      // heartbeat 등 파싱 불가 메시지 무시
    }
  };
  es.addEventListener("ALBUM_INVITE", (e) => {
    try { onNotification(JSON.parse(e.data)); } catch {}
  });
  es.addEventListener("ALBUM_VIDEO_ADDED", (e) => {
    try { onNotification(JSON.parse(e.data)); } catch {}
  });
  es.addEventListener("VIDEO_COMMENT", (e) => {
    try { onNotification(JSON.parse(e.data)); } catch {}
  });
  es.onerror = () => es.close();
  return () => es.close();
};
