// 사이드바의 공유 앨범 친구 항목과 설정 버튼을 렌더링하는 컴포넌트 파일
import { useEffect, useRef, useState } from "react";
import { Cog, Users, Pencil, LogOut } from "lucide-react";

type SidebarFriendItemProps = {
  label: string;
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

export default function SidebarFriendItem({
  label,
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
            "flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold text-white transition-transform hover:scale-105",
            isActive ? "bg-[#059669]" : "bg-[#10B981]",
          ].join(" ")}
        >
          {getInitial(label)}
        </button>
      </div>
    );
  }

  return (
    <div
      className={[
        "relative flex items-center justify-between rounded-xl px-4 py-3 transition-colors",
        isActive ? "bg-[#ECFDF5]" : "hover:bg-[#F7F9FC]",
      ].join(" ")}
    >
      <button
        type="button"
        onClick={onClick}
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
      >
        <span className={["flex h-5 w-5 items-center justify-center", isActive ? "text-[#059669]" : "text-[#94A3B8]"].join(" ")}>
          <Users size={16} strokeWidth={2} />
        </span>
        <span className={["truncate text-sm font-medium", isActive ? "text-[#059669]" : "text-[#1F2937]"].join(" ")}>
          {label}
        </span>
      </button>

      {/* 설정 버튼 + 드롭다운 */}
      <div ref={dropdownRef} className="relative">
        <button
          type="button"
          onClick={() => setIsDropdownOpen((prev) => !prev)}
          className={[
            "flex h-7 w-7 items-center justify-center rounded-md transition-colors",
            isDropdownOpen
              ? "bg-white text-[#2563EB]"
              : "text-[#94A3B8] hover:bg-white hover:text-[#64748B]",
          ].join(" ")}
          aria-label={`${label} 공유 앨범 설정`}
        >
          <Cog size={14} strokeWidth={2} />
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
