// 헤더 알림 아이콘 및 드롭다운 컴포넌트
import { useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { markNotificationRead } from "../../../api/notification";
import type { Notification } from "../../../api/notification";
import { useUpload } from "../../../context/UploadContext";
import { useNotification } from "../../../context/NotificationContext";
import { getVideoFull } from "../../../api/video";
import type { ViewerVideo } from "../../../types/viewer";

function timeAgo(createdAt: string): string {
  const diff = Math.floor((Date.now() - new Date(createdAt).getTime()) / 1000);
  if (diff < 60) return "방금 전";
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
  return `${Math.floor(diff / 86400)}일 전`;
}

export default function NotificationButton() {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { setUploadedAlbumVideoId, uploadedAlbumVideoId } = useUpload();
  const { notifications, unreadCount, markRead, markAllRead } = useNotification();

  // 외부 클릭 시 드롭다운 닫기
  useEffect(() => {
    if (!isOpen) return;
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [isOpen]);

  // 아이콘 클릭 시 열기 — 드롭다운 열릴 때 전체 읽음처리
  const handleOpen = () => {
    const next = !isOpen;
    setIsOpen(next);
    if (next) markAllRead();
  };

  const isCompletedNotification = (item: Notification) =>
    item.message.includes("완료") || item.type === "VIDEO_COMPLETED";

  const handleNotificationClick = async (item: Notification) => {
    markNotificationRead(item.id).catch(() => {});
    markRead(item.id);
    setIsOpen(false);

    // VIDEO_COMPLETED → 편집 페이지
    if (isCompletedNotification(item)) {
      const albumVideoId = item.albumVideoId ?? uploadedAlbumVideoId;
      if (albumVideoId) setUploadedAlbumVideoId(albumVideoId);
      navigate("/edit");
      return;
    }

    // VIDEO_COMMENT → 해당 영상 재생 화면
    if (item.type === "VIDEO_COMMENT" && item.videoId) {
      try {
        const res = await getVideoFull(item.videoId);
        const video: ViewerVideo = {
          id: item.videoId,
          title: res.video.title,
          date: "",
          duration: res.video.durationSec ? `${Math.floor(res.video.durationSec / 60)}:${String(res.video.durationSec % 60).padStart(2, "0")}` : "0:00",
          thumbnail: res.video.thumbnailUrl ?? undefined,
          videoUrl: res.video.videoUrl ?? undefined,
          subtitleUrl: res.video.subtitleUrl,
          soundEventUrl: res.video.soundEventUrl,
          vibrationBinaryUrl: res.video.vibrationBinaryUrl,
        };
        navigate("/viewer", { state: { video } });
      } catch {
        navigate("/main");
      }
      return;
    }

    // ALBUM_INVITE, ALBUM_VIDEO_ADDED → 메인 페이지 해당 공유앨범 열기
    if ((item.type === "ALBUM_INVITE" || item.type === "ALBUM_VIDEO_ADDED") && item.albumId) {
      navigate("/main", { state: { openAlbumId: item.albumId } });
      return;
    }
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label="알림"
        onClick={handleOpen}
        className="relative flex h-9 w-9 items-center justify-center rounded-full text-[#94A3B8] transition-colors hover:bg-[#F8FAFC] hover:text-[#475569]"
      >
        <Bell size={18} strokeWidth={2} />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#EF4444] px-1 text-[10px] font-bold leading-none text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-12 z-50 w-[calc(100vw-2rem)] max-w-80 rounded-2xl border border-[#E8EDF4] bg-white shadow-xl">
          <div className="border-b border-[#F1F5F9] px-4 py-3">
            <p className="text-sm font-bold text-[#1E293B]">알림</p>
          </div>

          {notifications.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-[#94A3B8]">
              새로운 알림이 없습니다
            </div>
          ) : (
            <ul className="max-h-80 overflow-y-auto py-1">
              {notifications.map((item) => {
                const isCompleted = isCompletedNotification(item);
                const subLabel =
                  isCompleted ? "클릭하여 편집 페이지로 이동" :
                  item.type === "VIDEO_COMMENT" ? "클릭하여 영상으로 이동" :
                  (item.type === "ALBUM_INVITE" || item.type === "ALBUM_VIDEO_ADDED") ? "클릭하여 앨범으로 이동" :
                  null;
                return (
                  <li
                    key={item.id}
                    onClick={() => handleNotificationClick(item)}
                    className={[
                      "flex cursor-pointer items-start gap-3 px-4 py-3 transition-colors hover:bg-[#F8FAFC]",
                      !item.isRead ? "bg-[#F0F7FF]" : "",
                    ].join(" ")}
                  >
                    <div className={["mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full", isCompleted ? "bg-[#ECFDF5]" : "bg-[#EEF4FF]"].join(" ")}>
                      <Bell size={13} className={isCompleted ? "text-[#059669]" : "text-[#2563EB]"} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm leading-snug text-[#334155]">{item.message}</p>
                      {subLabel && (
                        <p className={["mt-0.5 text-xs font-medium", isCompleted ? "text-[#059669]" : "text-[#2563EB]"].join(" ")}>{subLabel}</p>
                      )}
                      <p className="mt-0.5 text-xs text-[#94A3B8]">{timeAgo(item.createdAt)}</p>
                    </div>
                    {!item.isRead && (
                      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#2563EB]" />
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
