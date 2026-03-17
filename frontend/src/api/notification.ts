// 실시간 알림 SSE 구독 및 알림 목록 조회 관련 파일

import { apiClient } from "./client";

const BASE_URL = import.meta.env.VITE_API_BASE_URL;

export type NotificationListItem = {
  id: number;
  type: "ALBUM_INVITE" | "ALBUM_VIDEO_ADDED" | "VIDEO_COMMENT";
  message: string;
  isRead: boolean;
  createdAt: string;
};

// GET /api/notifications — 알림 목록 최신순 조회
export const getNotifications = (): Promise<NotificationListItem[]> =>
  apiClient.get<NotificationListItem[]>("/api/notifications").then((res) => res.data);

// GET /api/notifications/unread-count — 읽지 않은 알림 개수 조회
export const getUnreadNotificationCount = (): Promise<number> =>
  apiClient.get<{ count: number }>("/api/notifications/unread-count").then((res) => res.data.count);

// PATCH /api/notifications/{id}/read — 특정 알림 읽음 처리
export const markNotificationRead = (id: number): Promise<void> =>
  apiClient.patch(`/api/notifications/${id}/read`).then(() => {});

export type AlbumInvitePayload = {
  albumId: number;
  albumName: string;
  inviterName: string;
};

export type AlbumVideoAddedPayload = {
  albumId: number;
  albumName: string;
  uploaderName: string;
};

export type VideoCommentPayload = {
  videoId: number;
  commenterName: string;
};

export type NotificationHandlers = {
  onAlbumInvite?: (data: AlbumInvitePayload) => void;
  onAlbumVideoAdded?: (data: AlbumVideoAddedPayload) => void;
  onVideoComment?: (data: VideoCommentPayload) => void;
};

// GET /api/notifications/subscribe — SSE 실시간 알림 구독
export function subscribeNotifications(handlers: NotificationHandlers): EventSource {
  const es = new EventSource(`${BASE_URL}/api/notifications/subscribe`, {
    withCredentials: true,
  });

  es.addEventListener("ALBUM_INVITE", (e) => {
    handlers.onAlbumInvite?.(JSON.parse(e.data));
  });

  es.addEventListener("ALBUM_VIDEO_ADDED", (e) => {
    handlers.onAlbumVideoAdded?.(JSON.parse(e.data));
  });

  es.addEventListener("VIDEO_COMMENT", (e) => {
    handlers.onVideoComment?.(JSON.parse(e.data));
  });

  return es;
}
