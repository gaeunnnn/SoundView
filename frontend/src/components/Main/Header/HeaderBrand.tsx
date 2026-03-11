// 상단 헤더 좌측의 로고와 서비스명을 렌더링하는 컴포넌트 파일
type HeaderBrandProps = {
  title: string;
  onClick?: () => void;
};

export default function HeaderBrand({ title, onClick }: HeaderBrandProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-3 rounded-lg px-2 py-1 transition-colors hover:bg-[#F8FAFC]"
    >
      <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#2563EB] text-sm font-bold text-white">
        S
      </span>
      <span className="text-[22px] font-semibold tracking-[-0.02em] text-[#0F172A]">
        {title}
      </span>
    </button>
  );
}