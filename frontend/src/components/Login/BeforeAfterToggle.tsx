// BEFORE와 AFTER 상태 전환 UI를 보여주는 로그인 전용 컴포넌트 파일
type BeforeAfterToggleProps = {
  isAfterActive: boolean;
};

export default function BeforeAfterToggle({
  isAfterActive,
}: BeforeAfterToggleProps) {
  return (
    <div className="flex items-center gap-5">
      <button
        type="button"
        className={`flex h-12 min-w-[122px] items-center justify-center rounded-full border text-[14px] font-semibold transition ${
          !isAfterActive
            ? "border-[#BFD1FF] bg-[#F5F8FF] text-[#4F6EF7]"
            : "border-transparent bg-[#EEF1F6] text-[#A7B0C0]"
        }`}
      >
        BEFORE
      </button>

      <span className="text-xl text-[#C1C7D4]">→</span>

      <button
        type="button"
        className={`flex h-12 min-w-[122px] items-center justify-center rounded-full border text-[14px] font-semibold transition ${
          isAfterActive
            ? "border-[#BFD1FF] bg-[#F5F8FF] text-[#4F6EF7]"
            : "border-transparent bg-[#EEF1F6] text-[#A7B0C0]"
        }`}
      >
        AFTER
      </button>
    </div>
  );
}