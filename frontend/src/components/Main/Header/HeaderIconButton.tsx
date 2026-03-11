// 상단 헤더 우측의 아이콘 버튼 한 개를 렌더링하는 공통 컴포넌트 파일
import type { ReactNode } from "react";

type HeaderIconButtonProps = {
  ariaLabel: string;
  children: ReactNode;
  onClick?: () => void;
};

export default function HeaderIconButton({
  ariaLabel,
  children,
  onClick,
}: HeaderIconButtonProps) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={onClick}
      className="flex h-9 w-9 items-center justify-center rounded-full text-[#94A3B8] transition-colors hover:bg-[#F8FAFC] hover:text-[#475569]"
    >
      {children}
    </button>
  );
}