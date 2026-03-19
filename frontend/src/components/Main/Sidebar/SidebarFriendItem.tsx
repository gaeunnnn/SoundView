// 사이드바의 공유 앨범 친구 항목과 설정 버튼을 렌더링하는 컴포넌트 파일
import { useEffect, useRef, useState } from "react";
import { MoreVertical, Pencil, LogOut } from "lucide-react";
import type { SharedAlbumMember } from "../../../types/sidebar";

type SidebarFriendItemProps = {
  label: string;
  members?: SharedAlbumMember[];
  isActive?: boolean;
  isCollapsed?: boolean;
  onClick?: () => void;
  onClickSettings?: () => void;
  onClickRename?: () => void;
  onClickLeave?: () => void;
};

function getInitial(label: string) {
  return label.slice(0, 1);
}

function AvatarStack({ members, size = 20 }: { members: SharedAlbumMember[]; size?: number }) {
  const MAX_SHOW = 3;
  const shown = members.slice(0, MAX_SHOW);
  const extra = members.length - MAX_SHOW;
  const overlap = Math.round(size * 0.35);

  return (
    <div className="flex items-center" style={{ paddingLeft: overlap }}>
      {shown.map((m, i) => (
        <div
          key={m.userId}
          className="relative rounded-full ring-2 ring-white flex-shrink-0 overflow-hidden flex items-center justify-center text-white font-bold"
          style={{
            width: size,
            height: size,
            fontSize: size * 0.4,
            backgroundColor: m.avatarColor,
            marginLeft: -overlap,
            zIndex: shown.length - i,
          }}
        >
          {m.profileImageUrl ? (
            <img src={m.profileImageUrl} alt={m.nickname} className="w-full h-full object-cover" />
          ) : (
            getInitial(m.nickname)
          )}
        </div>
      ))}
      {extra > 0 && (
        <div
          className="relative rounded-full ring-2 ring-white flex-shrink-0 flex items-center justify-center bg-[#E2E8F0] text-[#64748B] font-semibold"
          style={{
            width: size,
            height: size,
            fontSize: size * 0.35,
            marginLeft: -overlap,
            zIndex: 0,
          }}
        >
          +{extra}
        </div>
      )}
    </div>
  );
}

export default function SidebarFriendItem({
  label,
  members = [],
  isActive = false,
  isCollapsed = false,
  onClick,
  onClickRename,
  onClickLeave,
}: SidebarFriendItemProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isDropdownOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isDropdownOpen]);

  if (isCollapsed) {
    return (
      <div className="flex justify-center">
        <button
          type="button"
          onClick={onClick}
          title={label}
          className={[
            "flex h-9 w-9 items-center justify-center rounded-xl transition-all hover:scale-105",
            isActive ? "bg-[#ECFDF5] ring-2 ring-[#10B981]/30" : "hover:bg-[#F0FDF9]",
          ].join(" ")}
        >
          {members.length > 0 ? (
            <AvatarStack members={members} size={members.length === 1 ? 26 : 18} />
          ) : (
            <span
              className={[
                "flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white",
                isActive ? "bg-[#059669]" : "bg-[#10B981]",
              ].join(" ")}
            >
              {getInitial(label)}
            </span>
          )}
        </button>
      </div>
    );
  }

  return (
    <div
      className={[
        "relative flex items-center justify-between rounded-xl px-4 py-3 transition-colors",
        isActive ? "bg-[#ECFDF5]" : "hover:bg-[#F0FDF9]",
      ].join(" ")}
    >
      <button
        type="button"
        onClick={onClick}
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
      >
        <span className={["truncate text-sm font-semibold", isActive ? "text-[#059669]" : "text-[#374151]"].join(" ")}>
          {label}
        </span>
      </button>

      {/* 아바타 스택 */}
      {members.length > 0 && (
        <span className="flex items-center flex-shrink-0 mr-1">
          <AvatarStack members={members} size={18} />
        </span>
      )}

      {/* 설정 버튼 + 드롭다운 */}
      <div ref={dropdownRef} className="relative">
        <button
          type="button"
          onClick={() => setIsDropdownOpen((prev) => !prev)}
          className={[
            "flex h-7 w-7 items-center justify-center rounded-md transition-colors",
            isDropdownOpen
              ? "bg-white text-[#059669]"
              : "text-[#94A3B8] hover:bg-white hover:text-[#64748B]",
          ].join(" ")}
          aria-label={`${label} 공유 앨범 설정`}
        >
          <MoreVertical size={15} strokeWidth={2} />
        </button>

        {isDropdownOpen && (
          <div className="absolute right-0 top-8 z-50 min-w-30 rounded-xl border border-[#E8EDF4] bg-white py-1 shadow-lg">
            <button
              type="button"
              onClick={() => {
                setIsDropdownOpen(false);
                onClickRename?.();
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-[#334155] transition-colors hover:bg-[#F8FAFC]"
            >
              <Pencil size={13} className="text-[#64748B]" />
              이름 수정
            </button>
            <button
              type="button"
              onClick={() => {
                setIsDropdownOpen(false);
                onClickLeave?.();
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-[#EF4444] transition-colors hover:bg-[#FFF5F5]"
            >
              <LogOut size={13} className="text-[#EF4444]" />
              나가기
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
