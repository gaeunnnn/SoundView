// 사이드바 하단의 친구 찾기 버튼을 렌더링하는 컴포넌트 파일
import { Search } from "lucide-react";

type SidebarSearchButtonProps = {
  isCollapsed?: boolean;
  onClick?: () => void;
};

export default function SidebarSearchButton({
  isCollapsed = false,
  onClick,
}: SidebarSearchButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={isCollapsed ? "친구 찾기" : undefined}
      className={[
        "flex items-center rounded-xl border border-[#DCE3EE] bg-white text-sm font-medium text-[#64748B] transition-colors hover:bg-[#F8FAFC]",
        isCollapsed
          ? "h-10 w-10 justify-center"
          : "h-10 w-full justify-center gap-2 px-4",
      ].join(" ")}
    >
      <Search size={16} strokeWidth={2} />
      {!isCollapsed && <span>친구 찾기</span>}
    </button>
  );
}