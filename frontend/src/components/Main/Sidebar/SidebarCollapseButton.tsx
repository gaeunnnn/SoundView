// 사이드바 접기와 펼치기 버튼을 렌더링하는 컴포넌트 파일
import { ChevronLeft, ChevronRight } from "lucide-react";

type SidebarCollapseButtonProps = {
  isCollapsed: boolean;
  onClick: () => void;
};

export default function SidebarCollapseButton({
  isCollapsed,
  onClick,
}: SidebarCollapseButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={isCollapsed ? "사이드바 펼치기" : "사이드바 접기"}
      className="absolute right-0 top-1/2 z-20 hidden h-9 w-9 translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-[#BFDBFE] bg-[#EFF6FF] text-[#3B82F6] shadow-sm transition-colors hover:bg-[#DBEAFE] group-hover:flex"
    >
      {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
    </button>
  );
}