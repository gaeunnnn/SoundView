// 플레이어 중앙에 표시되는 재생/일시정지 오버레이 버튼 컴포넌트 파일
type PlayerOverlayProps = {
  isPlaying: boolean;
  showOverlay: boolean;
  onToggle: () => void;
};

export default function PlayerOverlay({ isPlaying, showOverlay, onToggle }: PlayerOverlayProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={[
        "absolute flex h-16 w-16 items-center justify-center rounded-full bg-black/50 text-white transition-opacity duration-500 hover:bg-black/70",
        showOverlay ? "opacity-100" : "opacity-0 pointer-events-none",
      ].join(" ")}
    >
      {isPlaying ? (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
          <path d="M8 5v14l11-7z" />
        </svg>
      ) : (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
          <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
        </svg>
      )}
    </button>
  );
}
