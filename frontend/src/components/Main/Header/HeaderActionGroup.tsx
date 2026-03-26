// 상단 헤더 우측의 도움말과 알림 버튼 영역을 묶는 컴포넌트 파일
import { useEffect, useRef, useState } from "react";
import { Bell, CircleHelp } from "lucide-react";
import { useLocation } from "react-router-dom";
import HeaderIconButton from "./HeaderIconButton";
import { useNotification } from "../../../context/NotificationContext";

type HelpItem = { icon: string; title: string; desc: string };

const HELP_MAP: Record<string, { heading: string; items: HelpItem[] }> = {
  "/main": {
    heading: "메인 페이지 도움말",
    items: [
      { icon: "🎬", title: "내 영상", desc: "업로드한 영상을 탭별로 확인할 수 있습니다." },
      { icon: "📁", title: "공유 앨범", desc: "사이드바에서 앨범을 선택하면 멤버들의 영상을 볼 수 있습니다." },
      { icon: "✏️", title: "편집 / 삭제", desc: "내 영상 카드의 ··· 버튼으로 편집하거나 삭제할 수 있습니다." },
      { icon: "📤", title: "공유 앨범에 가져오기", desc: "내 영상을 친구들과의 공유 앨범에 올려 함께 볼 수 있습니다." },
    ],
  },
  "/upload": {
    heading: "업로드 페이지 도움말",
    items: [
      { icon: "📂", title: "파일 선택", desc: "MP4, MOV, WebM 영상을 드래그하거나 클릭해서 선택하세요." },
      { icon: "🤖", title: "AI 자막 자동 생성", desc: "업로드 후 AI가 자막·이모지·진동 데이터를 자동으로 만듭니다." },
      { icon: "🔔", title: "백그라운드 처리", desc: "다른 화면으로 이동해도 처리가 완료되면 알림으로 알려드립니다." },
    ],
  },
  "/edit": {
    heading: "편집 페이지 도움말",
    items: [
      { icon: "📝", title: "자막 편집", desc: "자막 패널에서 텍스트를 클릭해 수정하거나 삭제할 수 있습니다." },
      { icon: "😊", title: "이모지 이벤트", desc: "소리 이벤트 구간에 이모지가 표시됩니다. 토글로 켜고 끌 수 있습니다." },
      { icon: "💧", title: "리퀴드 글라스", desc: "이모지 배경 효과로, 영상 재생 중에도 항상 표시됩니다." },
      { icon: "⌨️", title: "단축키", desc: "Space: 재생/정지  ·  ← →: 5초 이동  ·  F: 전체화면" },
    ],
  },
  "/viewer": {
    heading: "재생 페이지 도움말",
    items: [
      { icon: "▶️", title: "재생 컨트롤", desc: "하단 바에서 재생·일시정지·탐색·볼륨을 조절할 수 있습니다." },
      { icon: "💬", title: "자막", desc: "자막 버튼(CC)으로 자막을 켜고 끌 수 있습니다." },
      { icon: "😊", title: "이모지", desc: "소리 이벤트 구간에 이모지가 애니메이션과 함께 표시됩니다." },
      { icon: "💬", title: "댓글", desc: "영상 하단에서 댓글을 남기고 반응을 남길 수 있습니다." },
    ],
  },
};

type HeaderActionGroupProps = {
  onClickHelp?: () => void;
  onVideoCompleted?: (videoId: number) => void;
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
  const { notifications, unreadCount, markRead, markAllRead } = useNotification();
  const [open, setOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const helpRef = useRef<HTMLDivElement>(null);
  const location = useLocation();

  const helpContent = HELP_MAP[location.pathname] ?? null;

  // 알림 드롭다운 외부 클릭 시 닫기
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

  // 도움말 드롭다운 외부 클릭 시 닫기
  useEffect(() => {
    if (!helpOpen) return;
    const handle = (e: MouseEvent) => {
      if (helpRef.current && !helpRef.current.contains(e.target as Node)) {
        setHelpOpen(false);
      }
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [helpOpen]);

  const handleOpen = () => setOpen((p) => !p);

  return (
    <div className="flex items-center gap-1">
      {/* 도움말 버튼 */}
      <div ref={helpRef} className="relative">
        <HeaderIconButton
          ariaLabel="도움말"
          onClick={helpContent ? () => setHelpOpen((p) => !p) : onClickHelp}
        >
          <CircleHelp size={18} strokeWidth={2} />
        </HeaderIconButton>

        {helpOpen && helpContent && (
          <div className="absolute right-0 top-11 z-50 w-72 overflow-hidden rounded-2xl border border-[#E8EDF4] bg-white shadow-xl">
            <div className="border-b border-[#E8EDF4] px-4 py-3">
              <span className="text-sm font-semibold text-[#111827]">{helpContent.heading}</span>
            </div>
            <ul className="py-2">
              {helpContent.items.map((item) => (
                <li key={item.title} className="flex items-start gap-3 px-4 py-2.5">
                  <span className="mt-0.5 text-base leading-none">{item.icon}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[#111827]">{item.title}</p>
                    <p className="mt-0.5 text-xs text-[#64748B]">{item.desc}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

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
                <button
                  type="button"
                  onClick={markAllRead}
                  className="text-xs text-[#2563EB] hover:text-[#1D4ED8] transition-colors"
                >
                  모두 읽음
                </button>
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
                      onClick={() => markRead(n.id)}
                      className={[
                        "flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-[#F8FAFC]",
                        !n.isRead ? "bg-[#EFF6FF] hover:bg-[#DBEAFE]" : "",
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
