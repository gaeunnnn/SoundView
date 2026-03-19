// 상단 헤더 우측의 도움말과 알림 버튼 영역을 묶는 컴포넌트 파일
import { useEffect, useRef, useState } from "react";
import { Bell, CircleHelp } from "lucide-react";
import HeaderIconButton from "./HeaderIconButton";
import {
  getNotifications,
  getUnreadCount,
  markNotificationRead,
  subscribeNotifications,
  type Notification,
} from "../../../api/notification";

type HeaderActionGroupProps = {
  onClickHelp?: () => void;
};

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "방금";
  if (diffMin < 60) return `${diffMin}분 전`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}시간 전`;
  const diffDay = Math.floor(diffHour / 24);
  return `${diffDay}일 전`;
}

export default function HeaderActionGroup({ onClickHelp }: HeaderActionGroupProps) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 드롭다운 외부 클릭 시 닫기
  useEffect(() => {
    if (!open) return;
    const handle = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  // 읽지 않은 알림 개수 초기 로드 + SSE 구독
  useEffect(() => {
    getUnreadCount()
      .then((count) => setUnreadCount(count))
      .catch(() => {});

    const unsubscribe = subscribeNotifications((n) => {
      setNotifications((prev) => [n, ...prev]);
      setUnreadCount((prev) => prev + 1);
    });
    return unsubscribe;
  }, []);

  const handleOpen = () => {
    if (!open) {
      getNotifications()
        .then((data) => {
          setNotifications(data);
          setUnreadCount(data.filter((n) => !n.isRead).length);
        })
        .catch(() => {});
    }
    setOpen((p) => !p);
  };

  const handleRead = async (id: number) => {
    const target = notifications.find((n) => n.id === id);
    if (!target || target.isRead) return;
    await markNotificationRead(id).catch(() => {});
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
  };

  return (
    <div className="flex items-center gap-1">
      <HeaderIconButton ariaLabel="도움말" onClick={onClickHelp}>
        <CircleHelp size={18} strokeWidth={2} />
      </HeaderIconButton>

      {/* 알림 버튼 + 드롭다운 */}
      <div ref={dropdownRef} className="relative">
        <button
          type="button"
          aria-label="알림"
          onClick={handleOpen}
          className="relative flex h-9 w-9 items-center justify-center rounded-full text-[#94A3B8] transition-colors hover:bg-[#F1F5F9] hover:text-[#475569]"
        >
          <Bell size={18} strokeWidth={2} />
          {unreadCount > 0 && (
            <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#EF4444] px-0.5 text-[10px] font-bold leading-none text-white">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>

        {open && (
          <div className="absolute right-0 top-11 z-50 w-80 overflow-hidden rounded-2xl border border-[#E8EDF4] bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-[#E8EDF4] px-4 py-3">
              <span className="text-sm font-semibold text-[#111827]">알림</span>
              {unreadCount > 0 && (
                <span className="rounded-full bg-[#EFF6FF] px-2 py-0.5 text-xs font-semibold text-[#2563EB]">
                  {unreadCount}개 미확인
                </span>
              )}
            </div>

            <ul className="max-h-80 overflow-y-auto">
              {notifications.length === 0 ? (
                <li className="flex flex-col items-center justify-center gap-2 py-10 text-[#94A3B8]">
                  <Bell size={24} strokeWidth={1.5} />
                  <p className="text-sm">새로운 알림이 없습니다</p>
                </li>
              ) : (
                notifications.map((n) => (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => handleRead(n.id)}
                      className={[
                        "flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-[#F8FAFC]",
                        !n.isRead && "bg-[#EFF6FF] hover:bg-[#DBEAFE]",
                      ].join(" ")}
                    >
                      <span
                        className={[
                          "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                          n.isRead ? "bg-transparent" : "bg-[#2563EB]",
                        ].join(" ")}
                      />
                      <div className="min-w-0 flex-1">
                        <p className={["text-sm leading-snug", n.isRead ? "text-[#64748B]" : "font-medium text-[#111827]"].join(" ")}>
                          {n.message}
                        </p>
                        <p className="mt-0.5 text-xs text-[#94A3B8]">{formatDate(n.createdAt)}</p>
                      </div>
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
