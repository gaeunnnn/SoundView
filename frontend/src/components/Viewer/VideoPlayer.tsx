// 영상 플레이어 패널 전체를 관리하는 컴포넌트 파일 (재생 상태, 컨트롤 포함)
import { useState, useRef, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ViewerVideo, EmojiReaction } from "../../types/viewer";
import PlayerOverlay from "./PlayerOverlay";
import PlayerControls from "./PlayerControls";

function parseDuration(dur: string): number {
  const parts = dur.split(":").map(Number);
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return 0;
}

type VideoPlayerProps = {
  video: ViewerVideo;
  reactions: EmojiReaction[];
  onReact: (emoji: string) => void;
};

export default function VideoPlayer({ video, reactions, onReact }: VideoPlayerProps) {
  const totalSec = parseDuration(video.duration);

  const [isPlaying, setIsPlaying] = useState(true);
  const [currentSec, setCurrentSec] = useState(0);
  const [volume, setVolume] = useState(80);
  const [isMuted, setIsMuted] = useState(false);
  const [showVolume, setShowVolume] = useState(false);
  const [showOverlay, setShowOverlay] = useState(true);
  const [subtitleOn, setSubtitleOn] = useState(true);
  const [emojiOn, setEmojiOn] = useState(true);
  const [vibrateOn, setVibrateOn] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [showSidePanel, setShowSidePanel] = useState(true);

  const progressRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const overlayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const controlsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 전체화면 변경 감지
  useEffect(() => {
    const handleChange = () => {
      const fs = !!document.fullscreenElement;
      setIsFullscreen(fs);
      if (!fs) setShowControls(true); // 전체화면 종료 시 항상 표시
    };
    document.addEventListener("fullscreenchange", handleChange);
    return () => document.removeEventListener("fullscreenchange", handleChange);
  }, []);

  const handleFullscreen = () => {
    if (!document.fullscreenElement) {
      playerRef.current?.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

  const resetOverlayTimer = useCallback(() => {
    setShowOverlay(true);
    if (overlayTimerRef.current) clearTimeout(overlayTimerRef.current);
    overlayTimerRef.current = setTimeout(() => setShowOverlay(false), 1000);
  }, []);

  const resetControlsTimer = useCallback(() => {
    setShowControls(true);
    if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    controlsTimerRef.current = setTimeout(() => setShowControls(false), 2000);
  }, []);

  const handleMouseMove = useCallback(() => {
    if (isFullscreen) resetControlsTimer();
  }, [isFullscreen, resetControlsTimer]);

  // 키보드 단축키
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      switch (e.key) {
        case " ":
        case "k":
          e.preventDefault();
          setIsPlaying((p) => !p);
          resetOverlayTimer();
          break;
        case "ArrowRight":
          e.preventDefault();
          setCurrentSec((prev) => Math.min(totalSec, prev + 5));
          break;
        case "ArrowLeft":
          e.preventDefault();
          setCurrentSec((prev) => Math.max(0, prev - 5));
          break;
        case "ArrowUp":
          e.preventDefault();
          setVolume((prev) => { const next = Math.min(100, prev + 5); setIsMuted(false); return next; });
          break;
        case "ArrowDown":
          e.preventDefault();
          setVolume((prev) => { const next = Math.max(0, prev - 5); if (next === 0) setIsMuted(true); return next; });
          break;
        case "f":
        case "F":
          e.preventDefault();
          handleFullscreen();
          break;
        case "c":
        case "C":
          if (isFullscreen) {
            e.preventDefault();
            setShowSidePanel((p) => !p);
          }
          break;
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [totalSec, resetOverlayTimer, isFullscreen]);

  // 타이머 재생
  useEffect(() => {
    if (isPlaying) {
      intervalRef.current = setInterval(() => {
        setCurrentSec((prev) => {
          if (prev >= totalSec) {
            setIsPlaying(false);
            return totalSec;
          }
          return prev + 1;
        });
      }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isPlaying, totalSec]);

  // 진동: 비어있음 (sound events API 연결 후 활성화)

  const handleProgressClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressRef.current) return;
    const rect = progressRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setCurrentSec(Math.floor(ratio * totalSec));
  }, [totalSec]);

  const handleSkip = (sec: number) => {
    setCurrentSec((prev) => Math.max(0, Math.min(totalSec, prev + sec)));
  };

  const handlePlayPause = () => {
    setIsPlaying((p) => !p);
    resetOverlayTimer();
  };

  const progress = totalSec > 0 ? (currentSec / totalSec) * 100 : 0;

  return (
    <div className="flex flex-1 h-full overflow-hidden bg-[#0F172A]">
      {/* 플레이어 캔버스 */}
      <div
        ref={playerRef}
        className="relative flex flex-1 items-center justify-center overflow-hidden bg-[#0F172A]"
        onMouseMove={handleMouseMove}
        style={{ cursor: isFullscreen && !showControls ? "none" : "default" }}
      >
        <img
          src={video.thumbnail}
          alt={video.title}
          className="max-h-full max-w-full object-contain select-none"
          onClick={handlePlayPause}
          style={{ cursor: "pointer" }}
        />

        <PlayerOverlay
          isPlaying={isPlaying}
          showOverlay={showOverlay}
          onToggle={handlePlayPause}
        />

        {/* 전체화면 전용 읽기 전용 소리 패널 */}
        {isFullscreen && (
          <div
            className={[
              "absolute right-0 top-0 bottom-0 z-30 flex transition-all duration-300 ease-in-out",
              showSidePanel ? "w-64" : "w-0",
              (showControls || showSidePanel) ? "opacity-100" : "opacity-0 pointer-events-none",
            ].join(" ")}
          >
            {/* 토글 탭 */}
            <button
              type="button"
              onClick={() => setShowSidePanel((p) => !p)}
              className="absolute left-0 top-1/2 z-40 flex h-14 w-6 -translate-x-full -translate-y-1/2 items-center justify-center rounded-l-xl transition-colors"
              style={{
                background: "rgba(255,255,255,0.12)",
                backdropFilter: "blur(16px)",
                WebkitBackdropFilter: "blur(16px)",
                border: "1px solid rgba(255,255,255,0.2)",
                borderRight: "none",
              }}
            >
              {showSidePanel
                ? <ChevronRight size={14} className="text-white/80" />
                : <ChevronLeft size={14} className="text-white/80" />}
            </button>

            {/* 패널 본체 */}
            <div
              className="flex flex-1 flex-col overflow-hidden"
              style={{
                background: "rgba(15,23,42,0.75)",
                backdropFilter: "blur(24px) saturate(160%)",
                WebkitBackdropFilter: "blur(24px) saturate(160%)",
                borderLeft: "1px solid rgba(255,255,255,0.12)",
              }}
            >
              <div
                className="flex shrink-0 items-center gap-2 px-4 py-3"
                style={{ borderBottom: "1px solid rgba(255,255,255,0.1)" }}
              >
                <div className="h-2 w-2 rounded-full bg-[#10B981]" />
                <span className="text-sm font-semibold text-white">인식된 소리</span>
              </div>
              <div className="flex-1 overflow-y-auto" />
            </div>
          </div>
        )}

        <PlayerControls
          isPlaying={isPlaying}
          currentSec={currentSec}
          totalSec={totalSec}
          duration={video.duration}
          progress={progress}
          volume={volume}
          isMuted={isMuted}
          showVolume={showVolume}
          subtitleOn={subtitleOn}
          emojiOn={emojiOn}
          vibrateOn={vibrateOn}
          progressRef={progressRef}
          onProgressClick={handleProgressClick}
          onPlayPause={handlePlayPause}
          onSkip={handleSkip}
          onMuteToggle={() => setIsMuted((m) => !m)}
          onVolumeChange={(v) => { setVolume(v); setIsMuted(v === 0); }}
          onShowVolumeChange={setShowVolume}
          onReset={() => setCurrentSec(0)}
          soundEvents={[]}
          onSubtitleToggle={() => setSubtitleOn((v) => !v)}
          onEmojiToggle={() => setEmojiOn((v) => !v)}
          onVibrateToggle={() => setVibrateOn((v) => !v)}
          showControls={showControls}
          isFullscreen={isFullscreen}
          onFullscreen={handleFullscreen}
        />
      </div>
    </div>
  );
}
