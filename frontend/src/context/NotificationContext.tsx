// 알림 상태를 전역으로 관리하는 컨텍스트
import { createContext, useContext, useEffect, useState } from "react";
import {
  getNotifications,
  markNotificationRead,
  subscribeNotifications,
  type Notification,
} from "../api/notification";
import { useUpload } from "./UploadContext";
import { getAlbums, getAlbumVideos } from "../api/album";

type NotificationContextValue = {
  notifications: Notification[];
  unreadCount: number;
  markRead: (id: number) => void;
  markAllRead: () => void;
};

const NotificationContext = createContext<NotificationContextValue>({
  notifications: [],
  unreadCount: 0,
  markRead: () => {},
  markAllRead: () => {},
});

// 24시간 이내 알림만 필터링
function filterRecent(data: Notification[]): Notification[] {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  return data.filter((n) => new Date(n.createdAt).getTime() > cutoff);
}

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const { setUploadedAlbumVideoId } = useUpload();

  const reloadNotifications = () => {
    getNotifications()
      .then((data) => {
        const recent = filterRecent(data);
        setNotifications(recent);
        setUnreadCount(recent.filter((n) => !n.isRead).length);
      })
      .catch(() => {});
  };

  // 마운트 시 알림 목록 초기 로드
  useEffect(() => {
    reloadNotifications();
  }, []);

  // SSE 구독 — 새 알림 즉시 반영
  useEffect(() => {
    const unsubscribe = subscribeNotifications({
      onNotification: (n) => {
        const normalized = { ...n, isRead: n.isRead ?? (n as unknown as { read?: boolean }).read ?? false };
        setNotifications((prev) => {
          if (prev.some((p) => p.id === normalized.id)) return prev;
          return [normalized, ...prev];
        });
        setUnreadCount((prev) => prev + 1);
      },
      onVideoCompleted: (videoId, albumVideoId) => {
        reloadNotifications();
        if (albumVideoId) {
          setUploadedAlbumVideoId(albumVideoId);
        } else {
          // albumVideoId가 없으면 내 앨범에서 해당 videoId를 가진 영상 찾기
          getAlbums()
            .then((albums) => {
              // "내 앨범" 찾기 (멤버가 1명인 개인 앨범)
              const myAlbum = albums.find((a) => a.memberCount === 1) ?? albums[0];
              if (!myAlbum) return;
              return getAlbumVideos(myAlbum.albumId);
            })
            .then((videos) => {
              if (!videos || videos.length === 0) return;
              // 🔥 SSE로 받은 videoId와 일치하는 영상을 정확히 찾음
              const targetVideo = videos.find((v) => v.videoId === videoId);
              if (targetVideo) {
                setUploadedAlbumVideoId(targetVideo.albumVideoId);
              } else {
                // 만약 아직 리스트에 없다면 가장 최신 영상이라도 세팅 (폴백)
                setUploadedAlbumVideoId(videos[0].albumVideoId);
              }
            })
            .catch(() => {});
        }
      },
    });
    return unsubscribe;
  }, []);

  // 개별 알림 클릭 시 읽음처리
  const markRead = (id: number) => {
    const target = notifications.find((n) => n.id === id);
    if (!target || target.isRead) return;
    markNotificationRead(id).catch(() => {});
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    setUnreadCount((prev) => Math.max(0, prev - 1));
  };

  // 모두 읽음처리
  const markAllRead = () => {
    const unread = notifications.filter((n) => !n.isRead);
    if (unread.length === 0) return;
    unread.forEach((n) => markNotificationRead(n.id).catch(() => {}));
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
  };

  return (
    <NotificationContext.Provider value={{ notifications, unreadCount, markRead, markAllRead }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotification() {
  return useContext(NotificationContext);
}
