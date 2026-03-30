// 상단 헤더 좌측의 로고와 서비스명을 렌더링하는 컴포넌트 파일
import logoIcon from "../../../assets/images/LogoIcon.png";

type HeaderBrandProps = {
  title?: string;
  onClick?: () => void;
};

export default function HeaderBrand({ onClick }: HeaderBrandProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-2.5 rounded-lg px-2 py-1 transition-colors hover:bg-[#F8FAFC]"
    >
      <img src={logoIcon} alt="SoundView 로고" className="h-14 w-14 object-contain" />
      <span className="text-[22px] font-semibold tracking-[-0.02em] text-[#0F172A]">
        SoundView
      </span>
    </button>
  );
}