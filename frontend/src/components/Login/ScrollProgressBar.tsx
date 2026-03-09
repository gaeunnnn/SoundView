// 페이지 하단의 스크롤 진행 상태 바를 보여주는 로그인 전용 컴포넌트 파일
type ScrollProgressBarProps = {
  progress?: number;
};

export default function ScrollProgressBar({
  progress = 0.18,
}: ScrollProgressBarProps) {
  return (
    <div className="fixed bottom-0 left-0 z-30 h-[6px] w-full bg-[#DCE5FF]">
      <div
        className="h-full rounded-r-full bg-[#5B7CFA] transition-all duration-200"
        style={{ width: `${progress * 100}%` }}
      />
    </div>
  );
}