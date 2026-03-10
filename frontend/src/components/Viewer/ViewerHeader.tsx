// 영상 재생 페이지 상단 헤더 컴포넌트 파일
import { ArrowLeft } from "lucide-react";
import HeaderActionGroup from "../Main/Header/HeaderActionGroup";
import HeaderProfileButton from "../Main/Header/HeaderProfileButton";

type ViewerHeaderProps = {
  onBack: () => void;
};

export default function ViewerHeader({ onBack }: ViewerHeaderProps) {
  return (
    <div className="flex h-18 shrink-0 items-center justify-between border-b border-[#E8EDF4] bg-white px-5">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#2563EB]">
            <span className="text-xs font-bold text-white">S</span>
          </div>
          <span className="text-base font-bold text-[#111827]">SoundSee</span>
        </div>
        <div className="h-4 w-px bg-[#E8EDF4]" />
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm font-medium text-[#64748B] transition-colors hover:text-[#111827]"
        >
          <ArrowLeft size={15} strokeWidth={2} />
          뒤로가기
        </button>
      </div>
      <div className="flex items-center gap-3">
        <HeaderActionGroup />
        <HeaderProfileButton userName="박민준" />
      </div>
    </div>
  );
}
