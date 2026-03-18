// 알림 관련 API 함수를 모아두는 파일

import { apiClient } from "./client";

export type Notification = {
  id: number;
  type: string;
  message: string;
  isRead: boolean;
  createdAt: string;
};

export type UnreadCount = {
  count: number;
};

// GET /api/notifications — 로그인 사용자의 알림 목록을 최신순으로 조회
export const getNotifications = (): Promise<Notification[]> =>
  apiClient.get<Notification[]>("/api/notifications").then((res) => res.data);

// GET /api/notifications/unread-count — 읽지 않은 알림 개수 조회
export const getUnreadCount = (): Promise<UnreadCount> =>
  apiClient.get<UnreadCount>("/api/notifications/unread-count").then((res) => res.data);

// PATCH /api/notifications/{id}/read — 특정 알림을 읽음 상태로 변경
export const markNotificationRead = (id: number): Promise<void> =>
  apiClient.patch(`/api/notifications/${id}/read`).then(() => {});

const SSE_URL = `${import.meta.env.VITE_API_BASE_URL}/api/notifications/subscribe`;

// GET /api/notifications/subscribe — SSE 알림 구독 (새 알림 수신 시 onNotification 콜백 호출)
export const subscribeNotifications = (onNotification: (n: Notification) => void): () => void => {
  const es = new EventSource(SSE_URL, { withCredentials: true });
  es.onmessage = (e) => {
    try {
      const data = JSON.parse(e.data) as Notification;
      onNotification(data);
    } catch {
      // heartbeat 등 파싱 불가 메시지 무시
    }
  };
  es.onerror = () => es.close();
  return () => es.close();
};
