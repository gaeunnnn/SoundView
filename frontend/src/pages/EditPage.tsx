// 자막 수정 페이지 - 업로드 완료 후 음성 인식 결과를 확인하고 편집하는 페이지
import { startTransition, useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, Download, ChevronRight, ChevronLeft,
  Subtitles,
  CheckCircle2, X,
} from "lucide-react";
import HeaderActionGroup from "../components/Main/Header/HeaderActionGroup";
import HeaderProfileButton from "../components/Main/Header/HeaderProfileButton";
import { useLocation } from "react-router-dom";
import { useUser } from "../context/UserContext";
import PlayerOverlay from "../components/Viewer/PlayerOverlay";
import PlayerControls from "../components/Viewer/PlayerControls";
import type { SoundEvent } from "../constants/edit";
import { useUpload } from "../context/UploadContext";
import { updateVideoTitle, getVideoFull, getEditSaveUrls } from "../api/video";
import type { VideoItem } from "../types/video";

function formatTime(sec: number) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

type ActiveEmoji = {
  eventId: number;
  emoji: string;
  triggeredAt: number;
  endSec: number; // 소리 인식 종료 시각
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
          <span className="text-base leading-none shrink-0">{ev.emoji}</span>
          <div className="flex flex-col min-w-0 flex-1">
            <span className={["truncate text-sm font-medium", isFullscreen ? "text-white/90" : "text-[#1E293B]"].join(" ")}>
              {ev.description}
            </span>
            <span className={["font-mono text-[10px]", isFullscreen ? "text-[#60A5FA]" : "text-[#2563EB]"].join(" ")}>
              {ev.timeSec.toFixed(1)}s ~ {ev.endSec.toFixed(1)}s · {ev.duration.toFixed(1)}s
            </span>
          </div>
        </button>
      ))}
    </>
  );
}

export default function EditPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { me } = useUser();
  const { uploadedVideoUrl, uploadedVideoId, uploadedAlbumVideoId, uploadedTitle } = useUpload();

  // 내 앨범에서 편집 버튼으로 진입 시 state로 전달된 video
  const stateVideo = location.state?.video as VideoItem | undefined;

  const [mediaUrl, setMediaUrl] = useState(uploadedVideoUrl ?? "");

  const isRealFile = !!mediaUrl;
  const mediaTitle = stateVideo?.title ?? uploadedTitle;

  // subtitle 상태
  const [subtitles, setSubtitles] = useState<{ start: number; end: number; text: string; emotion: string; confidence: number }[]>([]);
  // getVideoFull에서 받은 실제 videos.id (edit-save, PATCH에 사용)
  const [resolvedVideoId, setResolvedVideoId] = useState<number | null>(null);

  // videoId로 sound_event + subtitle 로드
  const loadVideoData = useCallback((videoId: number) => {
    getVideoFull(videoId).then((res) => {
      if (res.video.videoUrl) setMediaUrl(res.video.videoUrl);
      setResolvedVideoId(res.video.videoId);

      const soundUrl = res.video.soundEventUrl;
      if (soundUrl) {
        fetch(`${soundUrl}?t=${Date.now()}`)
          .then((r) => r.json())
          .then((data: { start: number; end: number; duration?: number; caption_label: string; emoji: string; enabled?: boolean }[]) => {
            setEvents(data.map((e, i) => {
              const dur = e.duration ?? (e.end - e.start);
              return {
                id: i,
                timeSec: e.start,
                endSec: e.end ?? e.start + 1,
                duration: dur,
                timeLabel: `${e.start.toFixed(1)}s`,
                emoji: e.emoji ?? "🔊",
                description: e.caption_label,
                enabled: e.enabled !== false,
              };
            }));
          })
          .catch(() => {});
      }

      const subtitleUrl = res.video.subtitleUrl;
      if (subtitleUrl) {
        fetch(`${subtitleUrl}?t=${Date.now()}`)
          .then((r) => r.json())
          .then((data: { start: number; end: number; text: string; emotion: string; confidence: number }[]) => {
            setSubtitles(data);
          })
          .catch(() => {});
      }
    }).catch(() => {});
  }, []);

  // 내 앨범에서 진입한 경우
  useEffect(() => {
    if (stateVideo) loadVideoData(stateVideo.id);
  }, [stateVideo?.id]);

  // 업로드 후 진입한 경우 — albumVideoId로 getVideoFull 호출
  useEffect(() => {
    if (!stateVideo && uploadedAlbumVideoId) loadVideoData(uploadedAlbumVideoId);
  }, [uploadedAlbumVideoId]);

  const [events, setEvents] = useState<SoundEvent[]>([]);
  const [isBuffering, setIsBuffering] = useState(true);
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentSec, setCurrentSec] = useState(0);
  const [subtitleOn, setSubtitleOn] = useState(true);
  const [emojiOn, setEmojiOn] = useState(true);
  const [activeEmojis, setActiveEmojis] = useState<ActiveEmoji[]>([]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showSidePanel, setShowSidePanel] = useState(true);
  const [showControls, setShowControls] = useState(true);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveName, setSaveName] = useState(mediaTitle);
  const savedRef = useRef(false);

  // uploadedTitle이 Context에서 늦게 반영될 경우를 대비해 동기화
  useEffect(() => {
    if (mediaTitle) setSaveName(mediaTitle);
  }, [mediaTitle]);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showOverlay, setShowOverlay] = useState(true);
  const [volume, setVolume] = useState(80);
  const [isMuted, setIsMuted] = useState(false);
  const [showVolume, setShowVolume] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<HTMLDivElement>(null);
  const controlsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const overlayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isPlayingRef = useRef(false);
  const handlePlayPauseRef = useRef<() => void>(() => {});

  const [totalSec, setTotalSec] = useState(0);
  const [duration, setDuration] = useState("00:00");
  const [currentTime, setCurrentTime] = useState(0); // 부드러운 프로그레스바용 실수값
  const enabledEvents = events.filter((e) => e.enabled);
  const enabledCount = enabledEvents.length;
  const progressPct = totalSec > 0 ? (currentTime / totalSec) * 100 : 0;

  const resetOverlayTimer = useCallback(() => {
    setShowOverlay(true);
    if (overlayTimerRef.current) clearTimeout(overlayTimerRef.current);
    overlayTimerRef.current = setTimeout(() => setShowOverlay(false), 1000);
  }, []);

  const resetControlsTimer = useCallback(() => {
    setShowControls(true);
    if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    controlsTimerRef.current = setTimeout(() => {
      if (isPlayingRef.current) setShowControls(false);
    }, 2000);
  }, []);

  const handleMouseMove = useCallback(() => {
    resetControlsTimer();
  }, [resetControlsTimer]);

  const handlePlayPause = useCallback(() => {
    const next = !isPlayingRef.current;
    setIsPlaying(next);
    resetOverlayTimer();
    if (next) resetControlsTimer();
  }, [resetOverlayTimer, resetControlsTimer]);

  // isPlayingRef 동기화 + 정지 시 컨트롤 복원
  useEffect(() => {
    isPlayingRef.current = isPlaying;
    if (!isPlaying) {
      setShowControls(true);
      if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    }
  }, [isPlaying]);

  // handlePlayPauseRef 항상 최신 함수 참조 유지
  useEffect(() => {
    handlePlayPauseRef.current = handlePlayPause;
  }, [handlePlayPause]);

  // 컨트롤/오버레이 타이머 클린업
  useEffect(() => {
    return () => {
      if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
      if (overlayTimerRef.current) clearTimeout(overlayTimerRef.current);
    };
  }, []);

  // 브라우저 탭 닫기 / 새로고침 시 경고
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (savedRef.current) return;
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);


  // isPlaying 변경 시 실제 video 태그 play/pause 제어
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (isPlaying) el.play().catch(() => {});
    else el.pause();
  }, [isPlaying]);

  // 볼륨 / 음소거 동기화
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    el.volume = isMuted ? 0 : volume / 100;
    el.muted = isMuted;
  }, [volume, isMuted]);

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

  // 이모지 오버레이 — start~end 범위 동안 표시 + end 후 5초 유지
  useEffect(() => {
    if (!emojiOn) return;
    startTransition(() => {
      setActiveEmojis((prev) => {
        // 새로 진입한 이모지 추가
        const nowActive = events.filter(
          (ev) => ev.enabled && currentSec >= ev.timeSec && currentSec < (ev.endSec ?? ev.timeSec + 1)
        );
        const newItems: ActiveEmoji[] = nowActive
          .filter((ev) => !prev.some((ae) => ae.eventId === ev.id))
          .map((ev) => ({ eventId: ev.id, emoji: ev.emoji, triggeredAt: currentSec, endSec: ev.endSec ?? ev.timeSec + 1 }));

        return [...prev, ...newItems]
          // end 후 5초 지난 것 제거
          .filter((ae) => currentSec < ae.endSec + 5)
          .slice(0, 5);
      });
    });
  }, [currentSec, emojiOn, events]);

  useEffect(() => {
    if (!emojiOn) startTransition(() => setActiveEmojis([]));
  }, [emojiOn]);


  // 키보드 단축키
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      switch (e.key) {
        case " ":
        case "k":
          e.preventDefault();
          handlePlayPauseRef.current();
          break;
        case "ArrowRight":
          e.preventDefault();
          if (videoRef.current) {
            videoRef.current.currentTime = Math.min(totalSec, videoRef.current.currentTime + 5);
          }
          break;
        case "ArrowLeft":
          e.preventDefault();
          if (videoRef.current) {
            videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 5);
          }
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
    const sec = Math.floor(ratio * totalSec);
    setCurrentSec(sec);
    if (videoRef.current) videoRef.current.currentTime = sec;
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
    // 비활성화 시 activeEmojis에서 즉시 제거
    setActiveEmojis((prev) => prev.filter((ae) => ae.eventId !== id));
  };

  const handleNavigateAway = (target: string) => {
    navigate(target);
  };

  const handleSave = async () => {
    if (!saveName.trim()) return;
    setSaveError(null);
    const targetVideoId = resolvedVideoId ?? uploadedVideoId ?? stateVideo?.videoId;
    if (!targetVideoId) {
      setSaveError("저장할 영상 ID를 찾을 수 없습니다.");
      return;
    }
    try {
      // 제목 수정 + 편집 저장 URL 발급 병렬 실행
      const [, urls] = await Promise.all([
        updateVideoTitle(targetVideoId, saveName.trim()),
        getEditSaveUrls(targetVideoId),
      ]);
      const uploadPromises: Promise<void>[] = [];

      if (urls?.soundEventUploadUrl) {
        const soundEventData = events.map((e) => ({
          start: e.timeSec,
          end: e.endSec,
          duration: e.duration,
          caption_label: e.description,
          emoji: e.emoji,
          enabled: e.enabled,
        }));
        uploadPromises.push(
          fetch(urls.soundEventUploadUrl, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(soundEventData),
          }).then((r) => { if (!r.ok) throw new Error(`soundEvent S3 업로드 실패: ${r.status}`); })
        );
      }

      if (urls?.subtitleUploadUrl && subtitles.length > 0) {
        uploadPromises.push(
          fetch(urls.subtitleUploadUrl, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(subtitles),
          }).then((r) => { if (!r.ok) throw new Error(`subtitle S3 업로드 실패: ${r.status}`); })
        );
      }

      await Promise.all(uploadPromises);
    } catch (err: unknown) {
      console.error("[저장 실패]", err);
      const axiosErr = err as { response?: { status: number; data: unknown } };
      const detail = axiosErr?.response
        ? `(${axiosErr.response.status}) ${JSON.stringify(axiosErr.response.data)}`
        : err instanceof Error ? err.message : String(err);
      setSaveError(`저장 중 오류가 발생했습니다: ${detail}`);
      return;
    }
    savedRef.current = true;
    setSaveSuccess(true);
    setTimeout(() => {
      setSaveSuccess(false);
      setShowSaveModal(false);
      navigate("/main");
    }, 1500);
  };

  const currentSubtitle = subtitleOn
    ? subtitles.find((s) => currentSec >= s.start && currentSec < s.end) ?? null
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
            onClick={() => handleNavigateAway("/main")}
            className="flex items-center gap-2 hover:opacity-80 transition-opacity"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#2563EB]">
              <span className="text-xs font-bold text-white">S</span>
            </div>
            <span className="hidden sm:block text-base font-bold text-[#111827]">SoundSee</span>
          </button>
          <button
            type="button"
            onClick={() => handleNavigateAway("/main")}
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
            onMouseMove={handleMouseMove}
            style={{ cursor: isFullscreen && !showControls ? "none" : "default" }}
          >
            {isRealFile ? (
              <>
                <video
                  ref={videoRef}
                  src={mediaUrl}
                  className="h-full w-full object-contain cursor-pointer"
                  onClick={handlePlayPause}
                  playsInline
                  preload="auto"
                  onLoadedMetadata={(e) => {
                    const sec = Math.floor(e.currentTarget.duration);
                    setTotalSec(sec);
                    setDuration(formatTime(sec));
                    setCurrentSec(0);
                  }}
                  onCanPlayThrough={() => setIsBuffering(false)}
                  onWaiting={() => setIsBuffering(true)}
                  onPlaying={() => setIsBuffering(false)}
                  onTimeUpdate={(e) => {
                    const t = e.currentTarget.currentTime;
                    setCurrentSec(Math.floor(t));
                    setCurrentTime(t);
                  }}
                  onEnded={() => setIsPlaying(false)}
                />
                {isBuffering && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                    <div className="flex flex-col items-center gap-2">
                      <svg className="animate-spin h-10 w-10 text-white" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                      <span className="text-white text-sm">영상 로딩 중...</span>
                    </div>
                  </div>
                )}
              </>
            ) : mediaUrl ? (
              <img
                src={mediaUrl}
                alt={mediaTitle}
                className="h-full w-full object-contain opacity-80 cursor-pointer"
                onClick={handlePlayPause}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white/80" />
              </div>
            )}

            <PlayerOverlay isPlaying={isPlaying} showOverlay={showOverlay} onToggle={handlePlayPause} />

            {/* 자막 오버레이 */}
            {subtitleOn && currentSubtitle && (
              <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
                <div
                  className="rounded-xl px-4 py-1.5 text-sm font-semibold text-white shadow-lg"
                  style={{ background: "rgba(0,0,0,0.7)", textShadow: "0 1px 4px rgba(0,0,0,0.8)" }}
                >
                  {currentSubtitle.text}
                </div>
              </div>
            )}

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
                    {activeEmojis.map((ae) => {
                      const isActive = currentSec < ae.endSec;
                      // end 후 경과 시간 (0~5초)
                      const fadeProgress = isActive ? 0 : Math.min(1, (currentSec - ae.endSec) / 5);
                      return (
                        <span
                          key={ae.eventId}
                          className={[
                            "text-4xl leading-none",
                            isActive ? "animate-pulse" : "transition-opacity duration-1000",
                          ].join(" ")}
                          style={{
                            filter: "drop-shadow(0 2px 8px rgba(0,0,0,0.3))",
                            opacity: 1 - fadeProgress,
                          }}
                        >
                          {ae.emoji}
                        </span>
                      );
                    })}
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

            <PlayerControls
              isPlaying={isPlaying}
              currentSec={currentSec}
              totalSec={totalSec}
              duration={duration}
              progress={progressPct}
              volume={volume}
              isMuted={isMuted}
              showVolume={showVolume}
              subtitleOn={subtitleOn}
              emojiOn={emojiOn}
              soundEvents={events}
              progressRef={progressRef}
              onProgressClick={handleProgressClick}
              onPlayPause={handlePlayPause}
              onSkip={(sec) => { if (videoRef.current) videoRef.current.currentTime = Math.max(0, Math.min(totalSec, videoRef.current.currentTime + sec)); }}
              onMuteToggle={() => setIsMuted((m) => !m)}
              onVolumeChange={(v) => { setVolume(v); setIsMuted(v === 0); }}
              onShowVolumeChange={setShowVolume}
              onReset={() => { if (videoRef.current) videoRef.current.currentTime = 0; setCurrentSec(0); }}
              onSubtitleToggle={() => setSubtitleOn((p) => !p)}
              onEmojiToggle={() => setEmojiOn((p) => !p)}
              showControls={showControls}
              isFullscreen={isFullscreen}
              onFullscreen={handleFullscreen}
            />
          </div>

          {/* 자막 표시줄 */}
          <div className="shrink-0 border-t border-[#E8EDF4] bg-white px-5 py-3">
            <div className="flex items-center gap-2 text-sm text-[#94A3B8]">
              <Subtitles size={14} className="shrink-0" />
              {currentSubtitle
                ? <span className="font-medium text-[#111827]">{currentSubtitle.text}</span>
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
    {/* 저장 없이 이탈 확인 모달 */}

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
                {saveError ? (
                  <div className="flex items-center gap-2 rounded-xl bg-[#FEF2F2] px-3.5 py-2.5">
                    <div className="h-2 w-2 shrink-0 rounded-full bg-[#EF4444]" />
                    <span className="text-sm text-[#DC2626]">{saveError}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 rounded-xl bg-[#F8FAFC] px-3.5 py-2.5">
                    <div className="h-2 w-2 rounded-full bg-[#10B981]" />
                    <span className="text-sm text-[#64748B]">내 앨범에 저장됩니다</span>
                  </div>
                )}
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
