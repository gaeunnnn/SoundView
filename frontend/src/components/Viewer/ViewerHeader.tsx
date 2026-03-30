// 영상 재생 페이지 상단 헤더 컴포넌트 파일
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import HeaderActionGroup from "../Main/Header/HeaderActionGroup";
import HeaderProfileButton from "../Main/Header/HeaderProfileButton";
import { useUser } from "../../context/UserContext";
import logoIcon from "../../assets/images/LogoIcon.png";

type ViewerHeaderProps = {
  onBack: () => void;
};

export default function ViewerHeader({ onBack }: ViewerHeaderProps) {
  const navigate = useNavigate();
  const { me } = useUser();
  return (
    <div className="flex h-[72px] shrink-0 items-center justify-between border-b border-[#E8EDF4] bg-white px-5 shadow-sm">
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => navigate("/main")}
          className="flex items-center gap-2.5 rounded-lg px-2 py-1 transition-colors hover:bg-[#F8FAFC]"
        >
          <img src={logoIcon} alt="SoundView 로고" className="h-14 w-14 object-contain" />
          <span className="hidden sm:block text-[22px] font-semibold tracking-[-0.02em] text-[#0F172A]">SoundView</span>
        </button>
        <div className="hidden sm:block h-4 w-px bg-[#E8EDF4]" />
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm font-medium text-[#64748B] transition-colors hover:text-[#111827]"
        >
          <ArrowLeft size={15} strokeWidth={2} />
          <span className="hidden sm:inline">뒤로가기</span>
        </button>
      </div>
      <div className="flex items-center gap-3">
        <HeaderActionGroup />
        <HeaderProfileButton userName={me?.nickname ?? ""} userCode={me?.userCode} profileImageUrl={me?.profileImageUrl} />
      </div>
    </div>
  );
}
