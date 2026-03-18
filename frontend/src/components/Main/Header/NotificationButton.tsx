// 헤더 알림 아이콘 및 드롭다운 컴포넌트
import { useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import {
  subscribeNotifications,
  getNotifications,
  getUnreadCount,
  markNotificationRead,
} from "../../../api/notification";
import type { Notification } from "../../../api/notification";

function timeAgo(createdAt: string): string {
  const diff = Math.floor((Date.now() - new Date(createdAt).getTime()) / 1000);
  if (diff < 60) return "방금 전";
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
  return `${Math.floor(diff / 86400)}일 전`;
}

export default function NotificationButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  // 마운트 시 읽지 않은 알림 개수 조회
  useEffect(() => {
    getUnreadCount().then(setUnreadCount).catch(() => {});
  }, []);

  // SSE 구독 — 새 알림 수신 시 목록 맨 앞에 추가
  useEffect(() => {
    const unsubscribe = subscribeNotifications((n: Notification) => {
      setNotifications((prev) => [n, ...prev]);
      setUnreadCount((c) => c + 1);
    });
    return unsubscribe;
  }, []);

  // 외부 클릭 시 드롭다운 닫기
  useEffect(() => {
    if (!isOpen) return;
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [isOpen]);

  // 아이콘 클릭 시 API로 알림 목록 조회
  const handleOpen = async () => {
    const next = !isOpen;
    setIsOpen(next);
    if (next) {
      setUnreadCount(0);
      try {
        const data = await getNotifications();
        setNotifications(data);
      } catch {
        // 조회 실패 시 기존 목록 유지
      }
    }
  };

  // 알림 항목 클릭 시 읽음 처리
  const handleClickItem = (item: Notification) => {
    if (item.isRead) return;
    markNotificationRead(item.id).catch(() => {});
    setNotifications((prev) =>
      prev.map((n) => (n.id === item.id ? { ...n, isRead: true } : n))
    );
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
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-[#EF4444]" />
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
              {notifications.map((item) => (
                <li
                  key={item.id}
                  onClick={() => handleClickItem(item)}
                  className={[
                    "flex cursor-pointer items-start gap-3 px-4 py-3 transition-colors hover:bg-[#F8FAFC]",
                    !item.isRead ? "bg-[#F0F7FF]" : "",
                  ].join(" ")}
                >
                  <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#EEF4FF]">
                    <Bell size={13} className="text-[#2563EB]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm leading-snug text-[#334155]">{item.message}</p>
                    <p className="mt-0.5 text-xs text-[#94A3B8]">{timeAgo(item.createdAt)}</p>
                  </div>
                  {!item.isRead && (
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#2563EB]" />
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
