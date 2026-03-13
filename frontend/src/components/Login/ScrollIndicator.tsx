// 사용자가 아래로 스크롤해야 함을 안내하는 로그인 전용 컴포넌트 파일
export default function ScrollIndicator() {
  return (
    <div className="flex flex-col items-center text-center">
      <p className="text-[12px] font-semibold text-[#A6AFBF]">
        스크롤하여 둘러보기
      </p>
      <span className="mt-2 text-[14px] text-[#A6AFBF]">⌄</span>
    </div>
  );
}