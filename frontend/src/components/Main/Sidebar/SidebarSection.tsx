// 사이드바 섹션 제목과 내부 영역을 감싸는 공통 컴포넌트 파일
import type { ReactNode } from "react";

type SidebarSectionProps = {
  title: string;
  isCollapsed?: boolean;
  children: ReactNode;
};

export default function SidebarSection({
  title,
  isCollapsed = false,
  children,
}: SidebarSectionProps) {
  return (
    <section className="space-y-3">
      {!isCollapsed && (
        <h3 className="px-3 text-xs font-semibold text-[#A0A8B8]">{title}</h3>
      )}
      <div className="space-y-2">{children}</div>
    </section>
  );
}