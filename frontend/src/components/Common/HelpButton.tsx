// 여러 페이지에서 공통으로 쓸 수 있는 우측 하단 도움말 버튼 파일
export default function HelpButton() {
  return (
    <button
      type="button"
      className="flex h-12 w-12 items-center justify-center rounded-full border border-[#E5E7EB] bg-white text-2xl text-[#4B5563] shadow-[0_4px_14px_rgba(15,23,42,0.08)]"
    >
      ?
    </button>
  );
}