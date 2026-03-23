// 자막 수정 페이지 - 업로드 완료 후 음성 인식 결과를 확인하고 편집하는 페이지
import { startTransition, useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, Download, ChevronRight, ChevronLeft,
  SkipBack, SkipForward, Play, Pause, Volume2,
  Subtitles, Smile, Vibrate, Settings, Maximize2, Minimize2,
  CheckCircle2, X,
} from "lucide-react";
import HeaderActionGroup from "../components/Main/Header/HeaderActionGroup";
import HeaderProfileButton from "../components/Main/Header/HeaderProfileButton";
import { useUser } from "../context/UserContext";
import PlayerOverlay from "../components/Viewer/PlayerOverlay";
import type { SoundEvent } from "../constants/edit";
import { useUpload } from "../context/UploadContext";
import { updateVideoTitle } from "../api/video";

function formatTime(sec: number) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

type ActiveEmoji = {
  eventId: number;
  emoji: string;
  triggeredAt: number;
};

// 소리 이벤트 목록 - 체크박스 포함 (수정 페이지)
function EventList({
  events,
  isFullscreen,
  onToggle,
}: {
  events: SoundEvent[];
  isFullscreen: boolean;
  onToggle: (id: number) => void;
}) {
  return (
    <>
      {events.map((ev) => (
        <button
          key={ev.id}
          type="button"
          onClick={() => onToggle(ev.id)}
          className={[
            "flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors",
            isFullscreen ? "hover:bg-white/10 text-white" : "hover:bg-[#F8FAFC]",
            !ev.enabled && "opacity-40",
          ].join(" ")}
        >
          <div
            className={[
              "flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 transition-colors",
              ev.enabled
                ? "border-[#2563EB] bg-[#2563EB]"
                : isFullscreen ? "border-white/40 bg-transparent" : "border-[#CBD5E1] bg-white",
            ].join(" ")}
          >
            {ev.enabled && (
              <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
                <path d="M1 3.5L3.2 5.5L8 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </div>
          <span className={["w-10 shrink-0 font-mono text-xs", isFullscreen ? "text-[#60A5FA]" : "text-[#2563EB]"].join(" ")}>
            {ev.timeLabel}
          </span>
          <span className="text-base leading-none">{ev.emoji}</span>
          <span className={["truncate text-sm", isFullscreen ? "text-white/90" : "text-[#1E293B]"].join(" ")}>
            {ev.description}
          </span>
        </button>
      ))}
    </>
  );
}

export default function EditPage() {
  const navigate = useNavigate();
  const { me } = useUser();
  const { uploadedVideoUrl, uploadedFileType, uploadedVideoId, uploadedTitle } = useUpload();

  const isRealFile = !!uploadedVideoUrl && uploadedFileType.startsWith("video/");
  const mediaUrl = uploadedVideoUrl ?? "";
  const mediaTitle = uploadedTitle;

  const [events, setEvents] = useState<SoundEvent[]>([]);
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentSec, setCurrentSec] = useState(0);
  const [hoveredDotId, setHoveredDotId] = useState<number | null>(null);
  const [subtitleOn, setSubtitleOn] = useState(true);
  const [emojiOn, setEmojiOn] = useState(true);
  const [vibrateOn, setVibrateOn] = useState(true);
  const [activeEmojis, setActiveEmojis] = useState<ActiveEmoji[]>([]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showSidePanel, setShowSidePanel] = useState(true);
  const [showControls, setShowControls] = useState(true);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveName, setSaveName] = useState(mediaTitle);

  // uploadedTitle이 Context에서 늦게 반영될 경우를 대비해 동기화
  useEffect(() => {
    if (mediaTitle) setSaveName(mediaTitle);
  }, [mediaTitle]);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showOverlay, setShowOverlay] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const shortcutsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showShortcuts) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (shortcutsRef.current && !shortcutsRef.current.contains(e.target as Node)) {
        setShowShortcuts(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showShortcuts]);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<HTMLDivElement>(null);
  const controlsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const overlayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [totalSec, setTotalSec] = useState(0);
  const [duration, setDuration] = useState("00:00");
  const enabledEvents = events.filter((e) => e.enabled);
  const enabledCount = enabledEvents.length;
  const progressPct = (currentSec / totalSec) * 100;

  // 컨트롤 자동 숨김 타이머 리셋
  const resetControlsTimer = useCallback(() => {
    setShowControls(true);
    if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    controlsTimerRef.current = setTimeout(() => setShowControls(false), 2000);
  }, []);

  // 오버레이 표시 타이머 (재생/정지 시에만 호출)
  const resetOverlayTimer = useCallback(() => {
    setShowOverlay(true);
    if (overlayTimerRef.current) clearTimeout(overlayTimerRef.current);
    overlayTimerRef.current = setTimeout(() => setShowOverlay(false), 1000);
  }, []);

  const handlePlayPause = useCallback(() => {
    setIsPlaying((p) => !p);
    resetOverlayTimer();
  }, [resetOverlayTimer]);

  // 컨트롤/오버레이 타이머 클린업
  useEffect(() => {
    return () => {
      if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
      if (overlayTimerRef.current) clearTimeout(overlayTimerRef.current);
    };
  }, []);

  // 재생 시뮬레이션
  useEffect(() => {
    if (isPlaying) {
      intervalRef.current = setInterval(() => {
        setCurrentSec((prev) => {
          if (prev >= totalSec) { setIsPlaying(false); return totalSec; }
          return prev + 1;
        });
      }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isPlaying, totalSec]);

  // 전체화면 변경 감지
  useEffect(() => {
    const onFsChange = () => {
      const fs = !!document.fullscreenElement;
      setIsFullscreen(fs);
      if (fs) setShowSidePanel(true);
    };
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  // 이모지 트리거 & 만료 관리
  useEffect(() => {
    if (!emojiOn) return;
    startTransition(() => {
      setActiveEmojis((prev) => {
        const newItems = events
          .filter((ev) => ev.enabled && currentSec === ev.timeSec)
          .filter((ev) => !prev.some((ae) => ae.eventId === ev.id))
          .map((ev) => ({ eventId: ev.id, emoji: ev.emoji, triggeredAt: currentSec }));
        return [...prev, ...newItems]
          .filter((ae) => currentSec - ae.triggeredAt < 5)
          .slice(-5);
      });
    });
  }, [currentSec, emojiOn, events]);

  useEffect(() => {
    if (!emojiOn) startTransition(() => setActiveEmojis([]));
  }, [emojiOn]);

  // 진동: 활성화된 이벤트 타이밍에 vibrate 호출
  useEffect(() => {
    if (!vibrateOn || !("vibrate" in navigator)) return;
    const triggered = events.filter((ev) => ev.enabled && currentSec === ev.timeSec);
    if (triggered.length > 0) navigator.vibrate(200);
  }, [currentSec, vibrateOn, events]);

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
        case "f":
        case "F":
          e.preventDefault();
          if (!playerRef.current) break;
          if (!document.fullscreenElement) {
            playerRef.current.requestFullscreen();
          } else {
            document.exitFullscreen();
          }
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

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressRef.current) return;
    const rect = progressRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setCurrentSec(Math.floor(ratio * totalSec));
  };

  const handleFullscreen = () => {
    if (!playerRef.current) return;
    if (!document.fullscreenElement) {
      playerRef.current.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

  const handleTogglePanel = () => {
    const next = !showSidePanel;
    setShowSidePanel(next);
    // 패널 접을 때 컨트롤도 함께 숨김
    if (!next) {
      if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
      setShowControls(false);
    }
  };

  const toggleEvent = (id: number) => {
    setEvents((prev) => prev.map((ev) => (ev.id === id ? { ...ev, enabled: !ev.enabled } : ev)));
  };

  const handleSave = async () => {
    if (!saveName.trim()) return;
    // 제목이 변경된 경우 PATCH /api/videos/{videoId}로 업데이트
    if (uploadedVideoId && saveName.trim() !== uploadedTitle) {
      await updateVideoTitle(uploadedVideoId, saveName.trim()).catch(console.error);
    }
    setSaveSuccess(true);
    setTimeout(() => {
      setSaveSuccess(false);
      setShowSaveModal(false);
      navigate("/main");
    }, 1500);
  };

  const currentSubtitle = subtitleOn
    ? enabledEvents.find((e) => Math.abs(e.timeSec - currentSec) <= 3) ?? null
    : null;

  return (
    <>
    {/* Liquid Glass SVG 필터 */}
    <svg style={{ display: "none" }}>
      <filter id="glass-distortion" x="0%" y="0%" width="100%" height="100%" filterUnits="objectBoundingBox">
        <feTurbulence type="fractalNoise" baseFrequency="0.001 0.005" numOctaves="1" seed="17" result="turbulence" />
        <feComponentTransfer in="turbulence" result="mapped">
          <feFuncR type="gamma" amplitude="1" exponent="10" offset="0.5" />
          <feFuncG type="gamma" amplitude="0" exponent="1" offset="0" />
          <feFuncB type="gamma" amplitude="0" exponent="1" offset="0.5" />
        </feComponentTransfer>
        <feGaussianBlur in="turbulence" stdDeviation="3" result="softMap" />
        <feSpecularLighting in="softMap" surfaceScale="5" specularConstant="1" specularExponent="100" lightingColor="white" result="specLight">
          <fePointLight x="-200" y="-200" z="300" />
        </feSpecularLighting>
        <feComposite in="specLight" operator="arithmetic" k1="0" k2="1" k3="1" k4="0" result="litImage" />
        <feDisplacementMap in="SourceGraphic" in2="softMap" scale="200" xChannelSelector="R" yChannelSelector="G" />
      </filter>
    </svg>
    <div className="h-screen flex flex-col overflow-hidden bg-white">
      {/* 앱 헤더 */}
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-[#E8EDF4] bg-white px-5">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => navigate("/main")}
            className="flex items-center gap-2 hover:opacity-80 transition-opacity"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#2563EB]">
              <span className="text-xs font-bold text-white">S</span>
            </div>
            <span className="hidden sm:block text-base font-bold text-[#111827]">SoundSee</span>
          </button>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-sm font-medium text-[#64748B] transition-colors hover:text-[#111827]"
          >
            <ArrowLeft size={14} strokeWidth={2} />
            <span className="hidden sm:inline">뒤로가기</span>
          </button>
        </div>
        <div className="flex items-center gap-3">
          <HeaderActionGroup />
          <HeaderProfileButton userName={me?.nickname ?? ""} userCode={me?.userCode} profileImageUrl={me?.profileImageUrl} />
        </div>
      </div>

      {/* 본문 */}
      <div className="flex flex-1 overflow-hidden">
        {/* 좌측: 영상 영역 */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* 서브 헤더 */}
          <div className="flex shrink-0 items-center justify-between border-b border-[#E8EDF4] bg-white px-5 py-3">
            <div className="flex min-w-0 items-center gap-2 text-sm">
              <span className="shrink-0 font-semibold text-[#111827]">✨ 자막 수정</span>
              <ChevronRight size={14} className="shrink-0 text-[#94A3B8]" />
              <span className="truncate text-[#64748B]">{mediaTitle}</span>
            </div>
            <button
              type="button"
              onClick={() => setShowSaveModal(true)}
              className="ml-3 flex shrink-0 items-center gap-2 rounded-xl bg-[#2563EB] px-3 py-2 sm:px-4 text-sm font-semibold text-white hover:bg-[#1D4ED8] transition-colors"
            >
              <Download size={14} strokeWidth={2.5} />
              <span className="hidden sm:inline">저장하기</span>
            </button>
          </div>

          {/* 영상 플레이어 - fullscreen 컨테이너 */}
          <div
            ref={playerRef}
            className="relative flex-1 overflow-hidden bg-black"
            onMouseMove={resetControlsTimer}
            style={{ cursor: !showControls ? "none" : "default" }}
          >
            {isRealFile ? (
              <video
                src={mediaUrl}
                className="h-full w-full object-contain cursor-pointer"
                onClick={handlePlayPause}
                playsInline
                onLoadedMetadata={(e) => {
                  const sec = Math.floor(e.currentTarget.duration);
                  setTotalSec(sec);
                  setDuration(formatTime(sec));
                  setCurrentSec(0);
                }}
                onTimeUpdate={(e) => {
                  setCurrentSec(Math.floor(e.currentTarget.currentTime));
                }}
                ref={(el) => {
                  if (!el) return;
                  if (isPlaying) el.play().catch(() => {});
                  else el.pause();
                }}
              />
            ) : (
              <img
                src={mediaUrl}
                alt={mediaTitle}
                className="h-full w-full object-contain opacity-80 cursor-pointer"
                onClick={handlePlayPause}
              />
            )}

            <PlayerOverlay isPlaying={isPlaying} showOverlay={showOverlay} onToggle={handlePlayPause} />

            {/* Liquid Glass 이모지 오버레이 */}
            {emojiOn && activeEmojis.length > 0 && (
              <div className="absolute top-5 left-1/2 z-20 -translate-x-1/2 pointer-events-none">
                {/* Glass container */}
                <div
                  className="relative overflow-hidden rounded-3xl"
                  style={{
                    boxShadow: "0 6px 6px rgba(0,0,0,0.2), 0 0 20px rgba(0,0,0,0.1)",
                  }}
                >
                  {/* Layer 1: distortion blur */}
                  <div
                    className="absolute inset-0 z-0 overflow-hidden rounded-3xl"
                    style={{
                      backdropFilter: "blur(3px)",
                      filter: "url(#glass-distortion)",
                      isolation: "isolate",
                    }}
                  />
                  {/* Layer 2: white tint */}
                  <div
                    className="absolute inset-0 z-10 rounded-3xl"
                    style={{ background: "rgba(255,255,255,0.25)" }}
                  />
                  {/* Layer 3: inset highlight */}
                  <div
                    className="absolute inset-0 z-20 rounded-3xl"
                    style={{
                      boxShadow: "inset 2px 2px 1px 0 rgba(255,255,255,0.5), inset -1px -1px 1px 1px rgba(255,255,255,0.5)",
                    }}
                  />
                  {/* Content */}
                  <div className="relative z-30 flex items-center gap-3 px-6 py-3">
                    {activeEmojis.map((ae) => (
                      <span
                        key={ae.eventId}
                        className={[
                          "text-4xl leading-none transition-opacity duration-1000",
                          currentSec - ae.triggeredAt >= 4 ? "opacity-0" : "opacity-100",
                        ].join(" ")}
                        style={{ filter: "drop-shadow(0 2px 8px rgba(0,0,0,0.3))" }}
                      >
                        {ae.emoji}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* 전체화면 전용 우측 패널 */}
            {isFullscreen && (
              <div
                className={[
                  "absolute right-0 top-0 bottom-0 z-30 flex transition-all duration-300 ease-in-out",
                  showSidePanel ? "w-72" : "w-0",
                ].join(" ")}
              >
                {/* 토글 탭 - 컨트롤 표시 중일 때만 보임 */}
                <button
                  type="button"
                  onClick={handleTogglePanel}
                  className={[
                    "absolute left-0 top-1/2 z-40 flex h-14 w-6 -translate-x-full -translate-y-1/2 flex-col items-center justify-center rounded-l-xl transition-all duration-300",
                    (showControls || showSidePanel) ? "opacity-100" : "opacity-0 pointer-events-none",
                  ].join(" ")}
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
                    className="flex shrink-0 items-center justify-between px-4 py-3"
                    style={{ borderBottom: "1px solid rgba(255,255,255,0.1)" }}
                  >
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-[#10B981]" />
                      <span className="text-sm font-semibold text-white">인식된 소리</span>
                      <span className="text-sm text-white/50">{enabledCount}/{events.length}</span>
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto">
                    <EventList events={events} isFullscreen={isFullscreen} onToggle={toggleEvent} />
                  </div>
                </div>
              </div>
            )}

            {/* 하단 컨트롤 오버레이 */}
            <div className={[
              "absolute bottom-0 left-0 right-0 bg-linear-to-t from-black/95 via-black/60 to-transparent px-5 pb-5 pt-20 transition-opacity duration-500",
              showControls ? "opacity-100" : "opacity-0 pointer-events-none",
            ].join(" ")}>
              {/* 타임라인 */}
              <div
                ref={progressRef}
                onClick={handleProgressClick}
                className="group relative mb-4 h-1.5 w-full cursor-pointer rounded-full bg-white/25 hover:h-2 transition-all duration-150"
              >
                <div
                  className="absolute left-0 top-0 h-full rounded-full bg-[#2563EB] pointer-events-none"
                  style={{ width: `${progressPct}%` }}
                />
                <div
                  className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-md pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ left: `${progressPct}%` }}
                />
                {emojiOn && events.map((ev) => {
                  const leftPct = totalSec > 0 ? (ev.timeSec / totalSec) * 100 : 0;
                  return (
                    <div
                      key={ev.id}
                      className="absolute top-1/2 z-10 -translate-x-1/2 -translate-y-1/2"
                      style={{ left: `${leftPct}%` }}
                      onMouseEnter={() => setHoveredDotId(ev.id)}
                      onMouseLeave={() => setHoveredDotId(null)}
                    >
                      <div className={[
                        "h-2.5 w-2.5 rounded-full border-2 cursor-pointer transition-all hover:scale-125",
                        ev.enabled
                          ? "border-white/70 bg-[#F59E0B]"
                          : "border-white/30 bg-[#F59E0B]/30",
                      ].join(" ")} />
                      {hoveredDotId === ev.id && (
                        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-0.5 whitespace-nowrap rounded-xl bg-black/90 px-3 py-2 shadow-xl">
                          <span className={["text-lg leading-none", !ev.enabled && "opacity-40"].join(" ")}>{ev.emoji}</span>
                          <span className={["text-[11px] text-white", !ev.enabled && "line-through opacity-50"].join(" ")}>{ev.description}</span>
                          <span className="text-[10px] text-white/50">{ev.timeLabel}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* 컨트롤 버튼 행 */}
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setCurrentSec((s) => Math.max(0, s - 10))}
                  className="flex h-8 w-8 items-center justify-center text-white/60 hover:text-white transition-colors">
                  <SkipBack size={18} strokeWidth={2} />
                </button>
                <button type="button" onClick={handlePlayPause}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-[#111827] hover:bg-white/90 transition-colors">
                  {isPlaying
                    ? <Pause size={16} fill="currentColor" strokeWidth={0} />
                    : <Play size={16} fill="currentColor" strokeWidth={0} />}
                </button>
                <button type="button" onClick={() => setCurrentSec((s) => Math.min(totalSec, s + 10))}
                  className="flex h-8 w-8 items-center justify-center text-white/60 hover:text-white transition-colors">
                  <SkipForward size={18} strokeWidth={2} />
                </button>
                <button type="button" className="ml-1 text-white/60 hover:text-white transition-colors">
                  <Volume2 size={18} strokeWidth={2} />
                </button>
                <span className="ml-1 text-xs tabular-nums text-white/70">
                  {formatTime(currentSec)} / {duration}
                </span>

                <div className="ml-auto flex items-center gap-1.5">
                  <button type="button" onClick={() => setSubtitleOn((p) => !p)}
                    className={["flex h-8 w-8 items-center justify-center rounded-lg transition-colors",
                      subtitleOn ? "bg-[#F59E0B]/25 text-[#FCD34D]" : "text-white/50 hover:bg-white/10 hover:text-white"].join(" ")}
                    title="자막">
                    <Subtitles size={17} strokeWidth={2} />
                  </button>
                  <button type="button" onClick={() => setEmojiOn((p) => !p)}
                    className={["flex h-8 w-8 items-center justify-center rounded-lg transition-colors",
                      emojiOn ? "bg-[#EC4899]/25 text-[#F9A8D4]" : "text-white/50 hover:bg-white/10 hover:text-white"].join(" ")}
                    title="이모지">
                    <Smile size={17} strokeWidth={2} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setVibrateOn((p) => !p)}
                    className={["flex h-8 w-8 items-center justify-center rounded-lg transition-colors",
                      vibrateOn ? "bg-[#10B981]/25 text-[#6EE7B7]" : "text-white/50 hover:bg-white/10 hover:text-white"].join(" ")}
                    title="진동"
                  >
                    <Vibrate size={17} strokeWidth={2} />
                  </button>
                  <div ref={shortcutsRef} className="relative">
                    <button
                      type="button"
                      onClick={() => setShowShortcuts((p) => !p)}
                      className={[
                        "flex h-8 w-8 items-center justify-center rounded-lg transition-colors",
                        showShortcuts ? "bg-white/15 text-white" : "text-white/50 hover:bg-white/10 hover:text-white",
                      ].join(" ")}
                      title="단축키"
                    >
                      <Settings size={17} strokeWidth={2} />
                    </button>
                    {showShortcuts && (
                      <div
                        className="absolute bottom-10 right-0 z-50 w-52 rounded-xl p-3 text-xs text-white shadow-xl"
                        style={{
                          background: "rgba(15,23,42,0.92)",
                            border: "1px solid rgba(255,255,255,0.12)",
                        }}
                      >
                        <p className="mb-2 font-semibold text-white/50 uppercase tracking-wide text-[10px]">단축키</p>
                        <div className="space-y-1.5">
                          {[
                            ["Space / K", "재생 / 정지"],
                            ["← →", "5초 이동"],
                            ["F", "전체화면 전환"],
                            ["C", "자막 패널 (전체화면)"],
                          ].map(([key, desc]) => (
                            <div key={key} className="flex items-center justify-between gap-3">
                              <kbd className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[11px] text-white/80">{key}</kbd>
                              <span className="text-white/60">{desc}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <button type="button" onClick={handleFullscreen}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-white/50 hover:bg-white/10 hover:text-white transition-colors"
                    title={isFullscreen ? "전체화면 종료" : "전체화면"}>
                    {isFullscreen ? <Minimize2 size={17} strokeWidth={2} /> : <Maximize2 size={17} strokeWidth={2} />}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* 자막 표시줄 */}
          <div className="shrink-0 border-t border-[#E8EDF4] bg-white px-5 py-3">
            <div className="flex items-center gap-2 text-sm text-[#94A3B8]">
              <Subtitles size={14} className="shrink-0" />
              {currentSubtitle
                ? <span className="font-medium text-[#111827]">{currentSubtitle.emoji} {currentSubtitle.description}</span>
                : <span>자막이 표시되지 않습니다</span>}
            </div>
          </div>
        </div>

        {/* 우측: 소리 목록 패널 (일반 화면, 모바일에서 숨김) */}
        <div className="hidden md:flex w-72 shrink-0 flex-col border-l border-[#E8EDF4] bg-white">
          <div className="flex shrink-0 items-center justify-between border-b border-[#E8EDF4] px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-[#10B981]" />
              <span className="text-sm font-semibold text-[#111827]">인식된 소리</span>
              <span className="text-sm text-[#94A3B8]">{enabledCount}/{events.length}</span>
            </div>
            <button type="button" className="text-[#94A3B8] hover:text-[#64748B] transition-colors">
              <ChevronRight size={16} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            <EventList events={events} isFullscreen={false} onToggle={toggleEvent} />
          </div>
        </div>
      </div>
    </div>

    {/* 저장 모달 */}
    {showSaveModal && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl mx-4">
          {saveSuccess ? (
            /* 저장 완료 상태 */
            <div className="flex flex-col items-center gap-3 px-6 py-10">
              <CheckCircle2 size={48} className="text-[#10B981]" strokeWidth={1.5} />
              <p className="text-base font-semibold text-[#111827]">내 앨범에 저장되었습니다</p>
              <p className="text-sm text-[#64748B]">{saveName}</p>
            </div>
          ) : (
            /* 이름 입력 상태 */
            <>
              <div className="flex items-center justify-between border-b border-[#E8EDF4] px-5 py-4">
                <h2 className="text-base font-semibold text-[#111827]">영상 저장</h2>
                <button
                  type="button"
                  onClick={() => setShowSaveModal(false)}
                  className="text-[#94A3B8] hover:text-[#64748B] transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="px-5 py-5 flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-[#374151]">영상 이름</label>
                  <input
                    type="text"
                    value={saveName}
                    onChange={(e) => setSaveName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSave()}
                    className="rounded-xl border border-[#E2E8F0] px-3.5 py-2.5 text-sm text-[#111827] outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20 transition"
                    placeholder="영상 이름을 입력하세요"
                    autoFocus
                  />
                </div>
                <div className="flex items-center gap-2 rounded-xl bg-[#F8FAFC] px-3.5 py-2.5">
                  <div className="h-2 w-2 rounded-full bg-[#10B981]" />
                  <span className="text-sm text-[#64748B]">내 앨범에 저장됩니다</span>
                </div>
              </div>
              <div className="flex gap-2 border-t border-[#E8EDF4] px-5 py-4">
                <button
                  type="button"
                  onClick={() => setShowSaveModal(false)}
                  className="flex-1 rounded-xl border border-[#E2E8F0] py-2.5 text-sm font-medium text-[#475569] hover:bg-[#F8FAFC] transition-colors"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={!saveName.trim()}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#2563EB] py-2.5 text-sm font-semibold text-white hover:bg-[#1D4ED8] disabled:opacity-40 transition-colors"
                >
                  <Download size={14} strokeWidth={2.5} />
                  저장하기
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    )}
    </>
  );
}
