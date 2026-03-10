// 프로그레스 바와 재생 컨트롤 버튼 영역 컴포넌트 파일
import { Volume2, VolumeX, Maximize2, Minimize2, Subtitles, Smile, Vibrate } from "lucide-react";

type PlayerControlsProps = {
  isPlaying: boolean;
  currentSec: number;
  totalSec: number;
  duration: string;
  progress: number;
  volume: number;
  isMuted: boolean;
  showVolume: boolean;
  subtitleOn: boolean;
  emojiOn: boolean;
  vibrateOn: boolean;
  progressRef: React.RefObject<HTMLDivElement>;
  onProgressClick: (e: React.MouseEvent<HTMLDivElement>) => void;
  onPlayPause: () => void;
  onSkip: (sec: number) => void;
  onMuteToggle: () => void;
  onVolumeChange: (v: number) => void;
  onShowVolumeChange: (show: boolean) => void;
  onReset: () => void;
  onSubtitleToggle: () => void;
  onEmojiToggle: () => void;
  onVibrateToggle: () => void;
  showControls: boolean;
  isFullscreen: boolean;
  onFullscreen: () => void;
};

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function PlayerControls({
  isPlaying,
  currentSec,
  duration,
  progress,
  volume,
  isMuted,
  showVolume,
  subtitleOn,
  emojiOn,
  vibrateOn,
  progressRef,
  onProgressClick,
  onPlayPause,
  onSkip,
  onMuteToggle,
  onVolumeChange,
  onShowVolumeChange,
  onReset,
  onSubtitleToggle,
  onEmojiToggle,
  onVibrateToggle,
  showControls,
  isFullscreen,
  onFullscreen,
}: PlayerControlsProps) {
  const effectiveVolume = isMuted ? 0 : volume;

  const hidden = isFullscreen && !showControls;

  return (
    <div className={[
      "absolute bottom-0 left-0 right-0 bg-linear-to-t from-black/90 via-black/40 to-transparent px-4 pb-3 pt-10 transition-opacity duration-500",
      hidden ? "opacity-0 pointer-events-none" : "opacity-100",
    ].join(" ")}>
      {/* 프로그레스 바 */}
      <div
        ref={progressRef}
        className="group mb-3 h-1.5 w-full cursor-pointer rounded-full bg-white/20 hover:h-2.5 transition-all"
        onClick={onProgressClick}
      >
        <div className="h-full rounded-full bg-[#2563EB] relative" style={{ width: `${progress}%` }}>
          <div className="absolute right-0 top-1/2 -translate-y-1/2 h-3.5 w-3.5 rounded-full bg-white opacity-0 group-hover:opacity-100 shadow" />
        </div>
      </div>

      {/* 버튼 행 */}
      <div className="flex items-center justify-between">
        {/* 좌측 */}
        <div className="flex items-center gap-3 text-white">
          {/* 10초 뒤로 */}
          <button type="button" onClick={() => onSkip(-10)} className="opacity-75 hover:opacity-100 transition-opacity" title="10초 뒤로">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z" />
              <text x="7" y="16" fontSize="6" fill="currentColor">10</text>
            </svg>
          </button>

          {/* 재생/일시정지 */}
          <button
            type="button"
            onClick={onPlayPause}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-black shadow transition hover:scale-105"
          >
            {isPlaying ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
            )}
          </button>

          {/* 10초 앞으로 */}
          <button type="button" onClick={() => onSkip(10)} className="opacity-75 hover:opacity-100 transition-opacity" title="10초 앞으로">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 5V1l5 5-5 5V7c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6h2c0 4.42-3.58 8-8 8s-8-3.58-8-8 3.58-8 8-8z" />
              <text x="7" y="16" fontSize="6" fill="currentColor">10</text>
            </svg>
          </button>

          {/* 볼륨 */}
          <div
            className="relative flex items-center gap-2"
            onMouseEnter={() => onShowVolumeChange(true)}
            onMouseLeave={() => onShowVolumeChange(false)}
          >
            <button type="button" onClick={onMuteToggle} className="opacity-75 hover:opacity-100 transition-opacity">
              {effectiveVolume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>
            {showVolume && (
              <input
                type="range"
                min={0}
                max={100}
                value={isMuted ? 0 : volume}
                onChange={(e) => onVolumeChange(Number(e.target.value))}
                className="w-20 accent-[#2563EB]"
              />
            )}
          </div>

          {/* 시간 */}
          <span className="text-xs font-medium tabular-nums">
            {formatTime(currentSec)} / {duration}
          </span>
        </div>

        {/* 우측 */}
        <div className="flex items-center gap-2 text-white/70">
          {/* 자막 - ON: 노란색 */}
          <button
            type="button"
            onClick={onSubtitleToggle}
            title="자막"
            className={[
              "flex items-center justify-center rounded-md p-1.5 transition-all",
              subtitleOn
                ? "bg-[#F59E0B]/20 text-[#FCD34D] shadow-sm"
                : "text-white/60 hover:bg-white/10 hover:text-white",
            ].join(" ")}
          >
            <Subtitles size={16} />
          </button>
          {/* 이모티콘 - ON: 분홍색 */}
          <button
            type="button"
            onClick={onEmojiToggle}
            title="이모티콘"
            className={[
              "flex items-center justify-center rounded-md p-1.5 transition-all",
              emojiOn
                ? "bg-[#EC4899]/20 text-[#F9A8D4] shadow-sm"
                : "text-white/60 hover:bg-white/10 hover:text-white",
            ].join(" ")}
          >
            <Smile size={16} />
          </button>
          {/* 진동 - ON: 초록색 */}
          <button
            type="button"
            onClick={onVibrateToggle}
            title="진동"
            className={[
              "flex items-center justify-center rounded-md p-1.5 transition-all",
              vibrateOn
                ? "bg-[#10B981]/20 text-[#6EE7B7] shadow-sm"
                : "text-white/60 hover:bg-white/10 hover:text-white",
            ].join(" ")}
          >
            <Vibrate size={16} />
          </button>
          <div className="w-px h-3.5 bg-white/20" />
          <button
            type="button"
            onClick={onReset}
            className="text-xs hover:text-white transition-colors"
            title="처음으로"
          >
            처음
          </button>
          <button
            type="button"
            onClick={onFullscreen}
            className="hover:text-white transition-colors"
            title={isFullscreen ? "전체화면 종료" : "전체화면"}
          >
            {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
        </div>
      </div>
    </div>
  );
}
