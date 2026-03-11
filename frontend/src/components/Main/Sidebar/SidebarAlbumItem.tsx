// 사이드바의 내 앨범 항목 한 줄을 렌더링하는 컴포넌트 파일
import { FolderOpen } from "lucide-react";

type SidebarAlbumItemProps = {
  label: string;
  isActive?: boolean;
  isCollapsed?: boolean;
  onClick?: () => void;
};

export default function SidebarAlbumItem({
  label,
  isActive = false,
  isCollapsed = false,
  onClick,
}: SidebarAlbumItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={isCollapsed ? label : undefined}
      className={[
        "flex w-full items-center rounded-xl text-left transition-colors",
        isCollapsed
          ? "justify-center px-0 py-3"
          : "gap-3 px-4 py-3",
        isActive
          ? "bg-[#EEF4FF] text-[#2563EB]"
          : "text-[#1F2937] hover:bg-[#F7F9FC]",
      ].join(" ")}
    >
      <span
        className={[
          "flex h-5 w-5 items-center justify-center rounded-md",
          isActive ? "text-[#2563EB]" : "text-[#94A3B8]",
        ].join(" ")}
      >
        <FolderOpen size={16} strokeWidth={2} />
      </span>

      {!isCollapsed && <span className="text-sm font-medium">{label}</span>}
    </button>
  );
}