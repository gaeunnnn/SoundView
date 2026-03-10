// 자막 수정 페이지 - 업로드 완료 후 음성 인식 결과를 확인하고 편집하는 페이지
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, Download, ChevronRight, ChevronLeft,
  SkipBack, SkipForward, Play, Pause, Volume2,
  Subtitles, Smile, Vibrate, Settings, Maximize2, Minimize2,
} from "lucide-react";
import HeaderActionGroup from "../components/Main/Header/HeaderActionGroup";
import HeaderProfileButton from "../components/Main/Header/HeaderProfileButton";
import type { SoundEvent } from "../constants/soundEdit";
import { DUMMY_EDIT_VIDEO, DUMMY_SOUND_EVENTS } from "../constants/soundEdit";

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

export default function SoundEditPage() {
  const navigate = useNavigate();
  const [events, setEvents] = useState<SoundEvent[]>(DUMMY_SOUND_EVENTS);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentSec, setCurrentSec] = useState(226);
  const [hoveredDotId, setHoveredDotId] = useState<number | null>(null);
  const [subtitleOn, setSubtitleOn] = useState(true);
  const [emojiOn, setEmojiOn] = useState(true);
  const [activeEmojis, setActiveEmojis] = useState<ActiveEmoji[]>([]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showSidePanel, setShowSidePanel] = useState(true);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<HTMLDivElement>(null);

  const { totalSec, duration, thumbnail, title } = DUMMY_EDIT_VIDEO;
  const enabledEvents = events.filter((e) => e.enabled);
  const enabledCount = enabledEvents.length;
  const progressPct = (currentSec / totalSec) * 100;

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
      if (fs) setShowSidePanel(true); // 전체화면 진입 시 패널 기본 오픈
    };
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  // 이모지 트리거 & 만료 관리
  useEffect(() => {
    if (!emojiOn) return;
    setActiveEmojis((prev) => {
      const newItems = events
        .filter((ev) => ev.enabled && currentSec === ev.timeSec)
        .filter((ev) => !prev.some((ae) => ae.eventId === ev.id))
        .map((ev) => ({ eventId: ev.id, emoji: ev.emoji, triggeredAt: currentSec }));
      return [...prev, ...newItems]
        .filter((ae) => currentSec - ae.triggeredAt < 5)
        .slice(-5);
    });
  }, [currentSec, emojiOn, events]);

  useEffect(() => {
    if (!emojiOn) setActiveEmojis([]);
  }, [emojiOn]);

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

  const toggleEvent = (id: number) => {
    setEvents((prev) => prev.map((ev) => (ev.id === id ? { ...ev, enabled: !ev.enabled } : ev)));
  };

  const currentSubtitle = subtitleOn
    ? enabledEvents.find((e) => Math.abs(e.timeSec - currentSec) <= 3) ?? null
    : null;

  // 소리 이벤트 목록 (일반 + 전체화면 공통)
  const EventList = () => (
    <>
      {events.map((ev) => (
        <button
          key={ev.id}
          type="button"
          onClick={() => toggleEvent(ev.id)}
          className={[
            "flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors",
            isFullscreen
              ? "hover:bg-white/10 text-white"
              : "hover:bg-[#F8FAFC]",
            !ev.enabled && "opacity-40",
          ].join(" ")}
        >
          <div
            className={[
              "flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 transition-colors",
              ev.enabled ? "border-[#2563EB] bg-[#2563EB]" : isFullscreen ? "border-white/40 bg-transparent" : "border-[#CBD5E1] bg-white",
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

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-white">
      {/* 앱 헤더 */}
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-[#E8EDF4] bg-white px-5">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#2563EB]">
              <span className="text-xs font-bold text-white">S</span>
            </div>
            <span className="text-base font-bold text-[#111827]">SoundSee</span>
          </div>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-sm font-medium text-[#64748B] transition-colors hover:text-[#111827]"
          >
            <ArrowLeft size={14} strokeWidth={2} />
            대시보드
          </button>
        </div>
        <div className="flex items-center gap-3">
          <HeaderActionGroup />
          <HeaderProfileButton userName="박민준" />
        </div>
      </div>

      {/* 본문 */}
      <div className="flex flex-1 overflow-hidden">
        {/* 좌측: 영상 영역 */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* 서브 헤더 */}
          <div className="flex shrink-0 items-center justify-between border-b border-[#E8EDF4] bg-white px-5 py-3">
            <div className="flex items-center gap-2 text-sm">
              <span className="font-semibold text-[#111827]">✨ 자막 수정</span>
              <ChevronRight size={14} className="text-[#94A3B8]" />
              <span className="text-[#64748B]">{title}</span>
            </div>
            <button
              type="button"
              className="flex items-center gap-2 rounded-xl bg-[#2563EB] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1D4ED8] transition-colors"
            >
              <Download size={14} strokeWidth={2.5} />
              저장하기
            </button>
          </div>

          {/* 영상 플레이어 - fullscreen 컨테이너 */}
          <div ref={playerRef} className="relative flex-1 overflow-hidden bg-black">
            <img src={thumbnail} alt={title} className="h-full w-full object-cover opacity-80" />

            {/* Liquid Glass 이모지 오버레이 */}
            {emojiOn && activeEmojis.length > 0 && (
              <div className="absolute top-5 left-1/2 z-20 -translate-x-1/2 pointer-events-none">
                <div
                  className="flex items-center gap-3 rounded-3xl px-6 py-3"
                  style={{
                    background: "rgba(255,255,255,0.12)",
                    backdropFilter: "blur(24px) saturate(180%)",
                    WebkitBackdropFilter: "blur(24px) saturate(180%)",
                    border: "1px solid rgba(255,255,255,0.25)",
                    boxShadow: "0 8px 32px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.3)",
                  }}
                >
                  {activeEmojis.map((ae) => (
                    <span
                      key={ae.eventId}
                      className={[
                        "text-4xl leading-none transition-opacity duration-1000",
                        currentSec - ae.triggeredAt >= 4 ? "opacity-0" : "opacity-100",
                      ].join(" ")}
                      style={{ filter: "drop-shadow(0 2px 8px rgba(0,0,0,0.4))" }}
                    >
                      {ae.emoji}
                    </span>
                  ))}
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
                {/* 토글 탭 */}
                <button
                  type="button"
                  onClick={() => setShowSidePanel((p) => !p)}
                  className="absolute left-0 top-1/2 z-40 flex h-14 w-6 -translate-x-full -translate-y-1/2 flex-col items-center justify-center rounded-l-xl transition-colors"
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
                  {/* 패널 헤더 */}
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

                  {/* 이벤트 목록 */}
                  <div className="flex-1 overflow-y-auto">
                    <EventList />
                  </div>
                </div>
              </div>
            )}

            {/* 하단 컨트롤 오버레이 */}
            <div className="absolute bottom-0 left-0 right-0 bg-linear-to-t from-black/95 via-black/60 to-transparent px-5 pb-5 pt-20">
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
                {emojiOn && enabledEvents.map((ev) => {
                  const leftPct = (ev.timeSec / totalSec) * 100;
                  return (
                    <div
                      key={ev.id}
                      className="absolute top-1/2 z-10 -translate-x-1/2 -translate-y-1/2"
                      style={{ left: `${leftPct}%` }}
                      onMouseEnter={() => setHoveredDotId(ev.id)}
                      onMouseLeave={() => setHoveredDotId(null)}
                    >
                      <div className="h-2.5 w-2.5 rounded-full border-2 border-white/70 bg-[#F59E0B] cursor-pointer transition-transform hover:scale-125" />
                      {hoveredDotId === ev.id && (
                        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-0.5 whitespace-nowrap rounded-xl bg-black/90 px-3 py-2 shadow-xl">
                          <span className="text-lg leading-none">{ev.emoji}</span>
                          <span className="text-[11px] text-white">{ev.description}</span>
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
                <button type="button" onClick={() => setIsPlaying((p) => !p)}
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
                  <button type="button" className="flex h-8 w-8 items-center justify-center rounded-lg text-white/50 hover:bg-white/10 hover:text-white transition-colors" title="진동">
                    <Vibrate size={17} strokeWidth={2} />
                  </button>
                  <button type="button" className="flex h-8 w-8 items-center justify-center rounded-lg text-white/50 hover:bg-white/10 hover:text-white transition-colors" title="설정">
                    <Settings size={17} strokeWidth={2} />
                  </button>
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

        {/* 우측: 소리 목록 패널 (일반 화면) */}
        <div className="flex w-72 shrink-0 flex-col border-l border-[#E8EDF4] bg-white">
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
            <EventList />
          </div>
        </div>
      </div>
    </div>
  );
}
