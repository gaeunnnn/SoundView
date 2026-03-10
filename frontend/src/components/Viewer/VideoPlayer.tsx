// 영상 플레이어 패널 전체를 관리하는 컴포넌트 파일 (재생 상태, 컨트롤 포함)
import { useState, useRef, useEffect, useCallback } from "react";
import type { ViewerVideo, EmojiReaction } from "../../types/viewer";
import VideoMeta from "./VideoMeta";
import PlayerOverlay from "./PlayerOverlay";
import PlayerControls from "./PlayerControls";
import EmojiReactionBar from "./EmojiReactionBar";

const PRESET_EMOJIS: EmojiReaction[] = [
  { emoji: "👍", count: 2, reacted: false },
  { emoji: "❤️", count: 1, reacted: false },
  { emoji: "😂", count: 0, reacted: false },
  { emoji: "🔥", count: 3, reacted: false },
  { emoji: "😮", count: 0, reacted: false },
];

function parseDuration(dur: string): number {
  const parts = dur.split(":").map(Number);
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return 0;
}

type VideoPlayerProps = {
  video: ViewerVideo;
};

export default function VideoPlayer({ video }: VideoPlayerProps) {
  const totalSec = parseDuration(video.duration);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentSec, setCurrentSec] = useState(0);
  const [volume, setVolume] = useState(80);
  const [isMuted, setIsMuted] = useState(false);
  const [showVolume, setShowVolume] = useState(false);
  const [showOverlay, setShowOverlay] = useState(true);
  const [subtitleOn, setSubtitleOn] = useState(true);
  const [emojiOn, setEmojiOn] = useState(true);
  const [vibrateOn, setVibrateOn] = useState(true);
  const [reactions, setReactions] = useState<EmojiReaction[]>(PRESET_EMOJIS);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);

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
    resetOverlayTimer();
    if (isFullscreen) resetControlsTimer();
  }, [isFullscreen, resetOverlayTimer, resetControlsTimer]);

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

  const handleReact = (emoji: string) => {
    setReactions((prev) =>
      prev.map((r) =>
        r.emoji === emoji
          ? { ...r, reacted: !r.reacted, count: r.reacted ? Math.max(0, r.count - 1) : r.count + 1 }
          : r
      )
    );
  };

  const uploaderLabel = video.uploadedBy
    ? (video.uploadedBy.isMe ? "나" : video.uploadedBy.name)
    : "나";
  const progress = totalSec > 0 ? (currentSec / totalSec) * 100 : 0;

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-[#0F172A]">
      <VideoMeta title={video.title} uploaderLabel={uploaderLabel} date={video.date} />

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
          onSubtitleToggle={() => setSubtitleOn((v) => !v)}
          onEmojiToggle={() => setEmojiOn((v) => !v)}
          onVibrateToggle={() => setVibrateOn((v) => !v)}
          showControls={showControls}
          isFullscreen={isFullscreen}
          onFullscreen={handleFullscreen}
        />
      </div>

      <EmojiReactionBar reactions={reactions} onReact={handleReact} />
    </div>
  );
}
