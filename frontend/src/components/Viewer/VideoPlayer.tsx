// 영상 플레이어 패널 전체를 관리하는 컴포넌트 파일 (재생 상태, 컨트롤 포함)
import { useState, useRef, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ViewerVideo, EmojiReaction } from "../../types/viewer";
import PlayerOverlay from "./PlayerOverlay";
import PlayerControls from "./PlayerControls";
import { useEsp } from "../../context/EspContext";

// ── 타입 ──────────────────────────────────────────────────
type VibrationSample = { timestamp: number; intensity_l: number; intensity_r: number };

type SubtitleEntry = {
  id: number;
  start: number;
  end: number;
  text: string;
  emotion: string;
  confidence: number;
  enabled: boolean;
};

type SoundEventEntry = {
  id: number;
  start: number;
  end: number;
  // 새 포맷
  caption_label?: string;
  emoji?: string;
  // 구 포맷
  event?: string;
  event_en?: string;
  enabled: boolean;
};

type ActiveOverlay = {
  eventId: number | string;
  type: "sound" | "speech";
  emoji?: string;
  text?: string;
  triggeredAt: number;
  endSec: number;
};

// ── 로더 ──────────────────────────────────────────────────
// VIB1 파일 포맷:
//   [0-3]   "VIB1" 매직 (헤더 총 16바이트)
//   이후 frame_count × 2바이트: [uint8 intensity_l][uint8 intensity_r]
//   timestamp는 프레임 인덱스 × SAMPLE_INTERVAL_MS 로 계산
const VIB1_MAGIC = 0x31424956; // "VIB1" LE
const VIB1_HEADER_SIZE = 16;
const VIB1_FRAME_BYTES = 2;

async function loadVibrationBin(url: string): Promise<VibrationSample[]> {
  const res = await fetch(url);
  const buf = await res.arrayBuffer();
  const view = new DataView(buf);
  const samples: VibrationSample[] = [];

  const hasVib1Header =
    buf.byteLength >= VIB1_HEADER_SIZE &&
    view.getUint32(0, true) === VIB1_MAGIC;

  const dataStart = hasVib1Header ? VIB1_HEADER_SIZE : 0;
  const frameCount = Math.floor((buf.byteLength - dataStart) / VIB1_FRAME_BYTES);

  console.log(`[VIB] 파일: ${buf.byteLength}바이트, VIB1헤더: ${hasVib1Header}, 프레임수: ${frameCount}`);

  for (let i = 0; i < frameCount; i++) {
    const offset = dataStart + i * VIB1_FRAME_BYTES;
    samples.push({
      timestamp: (i * SAMPLE_INTERVAL_MS) / 1000,
      intensity_l: view.getUint8(offset),
      intensity_r: view.getUint8(offset + 1),
    });
  }
  return samples;
}

// ── 16-byte 프레임 빌더 ────────────────────────────────
// 포맷:
//   [0]     0xAA
//   [1]     0x55
//   [2]     seq       uint8
//   [3-6]   ts_ms     uint32 LE
//   [7]     sound_class uint8  (0 고정)
//   [8]     vib_type    uint8  (0 고정)
//   [9]     frequency   uint8  (0 고정)
//   [10]    intensity_L uint8
//   [11]    intensity_R uint8
//   [12-13] duration_ms uint16 LE  (샘플 간격 20ms 고정)
//   [14-15] checksum    uint16 LE  sum([0..13]) & 0xFFFF

const FRAME_SIZE = 16;
const SAMPLE_INTERVAL_MS = 20; // .bin 파일 샘플 간격

function buildFrame(seq: number, timestampMs: number, intensityL: number, intensityR: number): Uint8Array {
  const buf = new ArrayBuffer(FRAME_SIZE);
  const u8 = new Uint8Array(buf);
  const view = new DataView(buf);

  u8[0]  = 0xAA;
  u8[1]  = 0x55;
  u8[2]  = seq & 0xFF;
  view.setUint32(3, timestampMs >>> 0, true);
  u8[7]  = 0;   // sound_class
  u8[8]  = 0;   // vib_type
  u8[9]  = 0;   // frequency
  u8[10] = intensityL;
  u8[11] = intensityR;
  view.setUint16(12, SAMPLE_INTERVAL_MS, true);

  let sum = 0;
  for (let i = 0; i <= 13; i++) sum += u8[i];
  view.setUint16(14, sum & 0xFFFF, true);

  return u8;
}

// 전체 샘플을 [0xFF][0xFF][frames...] 형태로 빌드
function buildFullPacket(samples: VibrationSample[]): Uint8Array {
  const out = new Uint8Array(2 + samples.length * FRAME_SIZE);
  out[0] = 0xFF;
  out[1] = 0xFF;
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i];
    const tsMs = Math.round(s.timestamp * 1000);
    out.set(buildFrame(i & 0xFF, tsMs, s.intensity_l, s.intensity_r), 2 + i * FRAME_SIZE);
  }
  return out;
}

// 제어 명령 ─────────────────────────────────────────────
// [0x01, idxHi, idxLo]  재생 시작
// [0x02]                 정지
function cmdPlay(sampleIdx: number): Uint8Array {
  return new Uint8Array([0x01, (sampleIdx >> 8) & 0xFF, sampleIdx & 0xFF]);
}
function cmdPause(): Uint8Array {
  return new Uint8Array([0x02]);
}

function parseDuration(dur: string): number {
  const parts = dur.split(":").map(Number);
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return 0;
}

// emotion 문자열에서 이모지 매핑
const EMOTION_EMOJI: Record<string, string> = {
  "Happy (행복)": "😄",
  "Sad (슬픔)": "😢",
  "Angry (분노)": "😠",
  "Fear (불안)": "😨",
  "Surprise (당황)": "😮",
  "Disgust (혐오)": "🤢",
  "Neutral (중립)": "😐",
};

// ── 컴포넌트 ──────────────────────────────────────────────
type VideoPlayerProps = {
  video: ViewerVideo;
  reactions: EmojiReaction[];
  onReact: (emoji: string) => void;
};

export default function VideoPlayer({ video }: VideoPlayerProps) {
  const totalSec = parseDuration(video.duration);
  const { isConnected, status: espStatus, send, sendAndFlush } = useEsp();
  const [vibBuffering, setVibBuffering] = useState(false);

  // 영상 Blob 관련 상태
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [isDownloading, setIsDownloading] = useState(false);
  const blobUrlRef = useRef<string | null>(null);

  // 진동 데이터 (최초 1회 전송 여부)
  const vibSamplesRef = useRef<VibrationSample[]>([]);
  const vibSentRef = useRef(false);

  // 자막 / 효과음 데이터
  const [subtitles, setSubtitles] = useState<SubtitleEntry[]>([]);
  const [soundEvents, setSoundEvents] = useState<SoundEventEntry[]>([]);

  // 현재 시간 기준 활성 항목
  const [currentSubtitle, setCurrentSubtitle] = useState<SubtitleEntry | null>(null);
  const [activeOverlays, setActiveOverlays] = useState<ActiveOverlay[]>([]);

  // ── 데이터 로드 ────────────────────────────────────────────
  useEffect(() => {
    if (!video.videoUrl) return;

    vibSentRef.current = false;
    setIsDownloading(true);
    setDownloadProgress(0);

    // 1. 영상 파일 전체 다운로드 프로세스 (병렬 시작, await 안함)
    const loadVideoBlob = async () => {
      try {
        const res = await fetch(video.videoUrl!);
        if (!res.ok) throw new Error("영상 다운로드 실패");

        const contentLength = res.headers.get("content-length");
        const total = contentLength ? parseInt(contentLength, 10) : 0;
        let loaded = 0;

        const reader = res.body?.getReader();
        const chunks = [];
        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
            loaded += value.length;
            if (total) setDownloadProgress(Math.round((loaded / total) * 100));
          }
          const blob = new Blob(chunks, { type: "video/mp4" });
          const localUrl = URL.createObjectURL(blob);

          if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
          blobUrlRef.current = localUrl;
          setBlobUrl(localUrl);
        }
      } catch (err) {
        console.error("Video Download Error:", err);
      } finally {
        setIsDownloading(false);
      }
    };
    loadVideoBlob();

    // 2. 나머지 데이터들 병렬 로드 (즉시 시작)
    const fetchOptions = {
      cache: "no-store" as RequestCache
    };

    // 진동 데이터 로드
    const vibUrl = video.vibrationBinaryUrl
      ?? `${video.videoUrl.replace(/\/([^/]+)\.[^.]+$/, "")}/test_vibration.bin`;
    loadVibrationBin(vibUrl)
      .then((s) => {
        vibSamplesRef.current = s;
        console.log(`[VIB] 로드 완료: ${s.length}프레임, ${s.length * 6}바이트 (raw bin), 패킷 총 ${2 + s.length * FRAME_SIZE}바이트`);
      })
      .catch((e) => { console.error("[VIB] 로드 실패:", e); vibSamplesRef.current = []; });

    // 자막 로드
    const subtitleUrl = video.subtitleUrl
      ?? `${video.videoUrl.replace(/\/([^/]+)\.[^.]+$/, "")}/test_subtitle.json`;
    fetch(`${subtitleUrl}?t=${Date.now()}`, fetchOptions)
      .then(r => r.json())
      .then((data: any[]) => {
        const mapped = data.map((s, i) => ({
          ...s,
          id: i,
          enabled: s.enabled !== false && String(s.enabled) !== "false"
        })).filter(s => s.enabled);
        setSubtitles(mapped);
      })
      .catch(() => setSubtitles([]));


    // 효과음 로드
    const soundUrl = video.soundEventUrl
      ?? `${video.videoUrl.replace(/\/([^/]+)\.[^.]+$/, "")}/test_sound_event.json`;
      
    fetch(`${soundUrl}?t=${Date.now()}`, fetchOptions)
      .then(r => r.json())
      .then((data: any[]) => {
        // 👉 철벽 방어: 불리언 false든, 문자열 "false"든 무조건 걸러냅니다.
        const validEvents = data.map((e, i) => ({
          ...e,
          id: i,
          enabled: e.enabled !== false && String(e.enabled) !== "false"
        })).filter(e => e.enabled);
        
        setSoundEvents(validEvents);
      })
      .catch(() => setSoundEvents([]));

  }, [video.videoUrl, video.subtitleUrl, video.soundEventUrl, video.vibrationBinaryUrl]);

  // seek 완료 시 재생 중이면 새 위치부터 cmdPlay
  useEffect(() => {
    if (!isConnected) return;
    const el = videoRef.current;
    if (!el) return;
    const onSeeked = () => {
      if (!el.paused) {
        const idx = Math.min(
          Math.round(el.currentTime / (SAMPLE_INTERVAL_MS / 1000)),
          (vibSamplesRef.current.length || 1) - 1
        );
        send(cmdPlay(idx));
      }
    };
    el.addEventListener("seeked", onSeeked);
    return () => el.removeEventListener("seeked", onSeeked);
  }, [isConnected, send]);

  // 뷰어 언마운트 시 정지 명령
  useEffect(() => {
    return () => { send(cmdPause()); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── 플레이어 상태 ─────────────────────────────────────────
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentSec, setCurrentSec] = useState(0);
  const [volume, setVolume] = useState(80);
  const [isMuted, setIsMuted] = useState(false);
  const [showVolume, setShowVolume] = useState(false);
  const [showOverlay, setShowOverlay] = useState(true);
  const [subtitleOn, setSubtitleOn] = useState(true);
  const [emojiOn, setEmojiOn] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [showSidePanel, setShowSidePanel] = useState(true);

  const progressRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const overlayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const controlsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isPlayingRef = useRef(false);
  const handlePlayPauseRef = useRef<() => void>(() => {});

  // ── currentSec 변경 시 자막/효과음 업데이트 ──────────────
  useEffect(() => {
    const t = currentSec;
    setCurrentSubtitle(subtitles.find((s) => t >= s.start && t < s.end) ?? null);

    setActiveOverlays((prev) => {
      // 1. 현재 활성화된 소리 이벤트
      const nowActiveSounds = soundEvents.filter(
        (e) => e.enabled && t >= e.start && t < e.end
      );
      // 2. 현재 활성화된 자막 (사람 말)
      const nowActiveSpeech = subtitles.filter(
        (s) => s.enabled && t >= s.start && t < s.end
      );

      const newSounds: ActiveOverlay[] = nowActiveSounds
        .filter((e) => !prev.some((ao) => ao.type === "sound" && ao.eventId === e.id))
        .map((e) => ({
          eventId: e.id,
          type: "sound",
          emoji: getEmoji(e),
          text: getLabel(e),
          triggeredAt: t,
          endSec: e.end,
        }));

      const newSpeech: ActiveOverlay[] = nowActiveSpeech
        .filter((s) => !prev.some((ao) => ao.type === "speech" && ao.eventId === s.id))
        .map((s) => ({
          eventId: s.id,
          type: "speech",
          emoji: "💬",
          text: s.text,
          triggeredAt: t,
          endSec: s.end,
        }));

      return [...prev, ...newSounds, ...newSpeech]
        // end 후 5초 지난 것 제거
        .filter((ao) => t < ao.endSec + 5)
        .slice(-5); // 최신 5개 유지
    });
  }, [currentSec, subtitles, soundEvents]);

  // ── 전체화면 감지 ─────────────────────────────────────────
  useEffect(() => {
    const handleChange = () => {
      const fs = !!document.fullscreenElement;
      setIsFullscreen(fs);
      if (!fs) setShowControls(true);
    };
    document.addEventListener("fullscreenchange", handleChange);
    return () => document.removeEventListener("fullscreenchange", handleChange);
  }, []);

  // isPlayingRef 동기화 + 정지 시 컨트롤 복원
  useEffect(() => {
    isPlayingRef.current = isPlaying;
    if (!isPlaying) {
      setShowControls(true);
      if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    }
  }, [isPlaying]);

  // video 재생/정지
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (isPlaying) el.play().catch(() => {});
    else el.pause();
  }, [isPlaying]);


  // 볼륨
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    el.volume = isMuted ? 0 : volume / 100;
    el.muted = isMuted;
  }, [volume, isMuted]);

  const handleFullscreen = () => {
    if (!document.fullscreenElement) playerRef.current?.requestFullscreen();
    else document.exitFullscreen();
  };

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

  // 키보드 단축키
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      switch (e.key) {
        case " ": case "k":
          e.preventDefault(); handlePlayPauseRef.current(); resetOverlayTimer(); break;
        case "ArrowRight":
          e.preventDefault();
          if (videoRef.current) videoRef.current.currentTime = Math.min(videoRef.current.duration || totalSec, videoRef.current.currentTime + 5);
          else setCurrentSec((p) => Math.min(totalSec, p + 5));
          break;
        case "ArrowLeft":
          e.preventDefault();
          if (videoRef.current) videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 5);
          else setCurrentSec((p) => Math.max(0, p - 5));
          break;
        case "ArrowUp":
          e.preventDefault();
          setVolume((p) => { const n = Math.min(100, p + 5); setIsMuted(false); return n; }); break;
        case "ArrowDown":
          e.preventDefault();
          setVolume((p) => { const n = Math.max(0, p - 5); if (n === 0) setIsMuted(true); return n; }); break;
        case "f": case "F": e.preventDefault(); handleFullscreen(); break;
        case "c": case "C":
          if (isFullscreen) { e.preventDefault(); setShowSidePanel((p) => !p); } break;
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [totalSec, resetOverlayTimer, isFullscreen]);

  // 타이머 재생 (videoUrl 없을 때만)
  useEffect(() => {
    if (video.videoUrl) return;
    if (isPlaying) {
      intervalRef.current = setInterval(() => {
        setCurrentSec((p) => { if (p >= totalSec) { setIsPlaying(false); return totalSec; } return p + 1; });
      }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isPlaying, totalSec, video.videoUrl]);

  const handleProgressClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressRef.current) return;
    const rect = progressRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const newSec = Math.floor(ratio * totalSec);
    if (videoRef.current) videoRef.current.currentTime = newSec;
    setCurrentSec(newSec);
  }, [totalSec]);

  const handleSkip = (sec: number) => {
    if (videoRef.current) videoRef.current.currentTime = Math.max(0, Math.min(videoRef.current.duration || totalSec, videoRef.current.currentTime + sec));
    else setCurrentSec((p) => Math.max(0, Math.min(totalSec, p + sec)));
  };

  const handlePlayPause = useCallback(async () => {
    const nextPlaying = !isPlaying;
    resetOverlayTimer();
    if (nextPlaying) resetControlsTimer();

    if (nextPlaying && isConnected) {
      const samples = vibSamplesRef.current;
      if (samples.length && !vibSentRef.current) {
        setVibBuffering(true);
        try {
          const packet = buildFullPacket(samples);
          console.log("orig bin bytes =", samples.length * 6);
          console.log("esp packet bytes =", packet.byteLength);
          console.log("esp frames =", (packet.byteLength - 2) / 16);
          console.log("prefix =", packet[0], packet[1]);
          await sendAndFlush(packet);
          vibSentRef.current = true;
        } finally {
          setVibBuffering(false);
        }
      }
      const idx = Math.min(
        Math.round((videoRef.current?.currentTime ?? 0) / (SAMPLE_INTERVAL_MS / 1000)),
        (vibSamplesRef.current.length || 1) - 1
      );
      send(cmdPlay(idx));
    } else if (!nextPlaying && isConnected) {
      send(cmdPause());
    }

    setIsPlaying(nextPlaying);
  }, [isPlaying, isConnected, vibSentRef, send, sendAndFlush, resetOverlayTimer, resetControlsTimer]);

  // handlePlayPauseRef 항상 최신 함수 참조 유지
  useEffect(() => {
    handlePlayPauseRef.current = handlePlayPause;
  }, [handlePlayPause]);

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    setCurrentSec(videoRef.current.currentTime);
  };

  const progress = totalSec > 0 ? (currentSec / totalSec) * 100 : 0;

  // 포맷 무관하게 이모지/텍스트 추출
  const getEmoji = (e: SoundEventEntry) =>
    e.emoji ?? e.event?.match(/[\u{1F300}-\u{1FFFF}]|[\u{2600}-\u{27FF}]/u)?.[0] ?? "🔊";
  const getLabel = (e: SoundEventEntry) =>
    e.caption_label ?? e.event_en ?? e.event ?? "";

  // 프로그레스 바용 효과음 도트 (PlayerControls의 SoundEvent 형태로 변환)
  const soundEventDots = emojiOn ? soundEvents.filter((e) => e.enabled !== false).map((e, i) => ({
    id: i,
    timeSec: e.start,
    endSec: e.end,
    duration: e.end - e.start,
    timeLabel: `${e.start.toFixed(1)}s`,
    emoji: getEmoji(e),
    description: getLabel(e),
    enabled: true,
  })) : [];

  return (
    <div className="flex flex-1 h-full overflow-hidden bg-[#0F172A]">
      <div
        ref={playerRef}
        className="relative flex flex-1 items-center justify-center overflow-hidden bg-[#0F172A]"
        onMouseMove={handleMouseMove}
        style={{ cursor: isFullscreen && !showControls ? "none" : "default" }}
      >
        {/* 영상 or 로딩 or 썸네일 */}
        {video.videoUrl ? (
          <>
            <video
              ref={videoRef}
              src={blobUrl || undefined}
              className="max-h-full max-w-full object-contain"
              onClick={handlePlayPause}
              onTimeUpdate={handleTimeUpdate}
              onEnded={() => { if (isConnected) send(cmdPause()); setIsPlaying(false); }}
              style={{ cursor: "pointer", display: blobUrl ? "block" : "none" }}
              playsInline
              preload="auto"
            />
            {!blobUrl && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                <div className="flex flex-col items-center gap-2">
                  <svg className="animate-spin h-10 w-10 text-white" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  <span className="text-white text-sm">
                    {isDownloading ? `영상 다운로드 중... (${downloadProgress}%)` : "영상 준비 중..."}
                  </span>
                </div>
              </div>
            )}
          </>
        ) : video.thumbnail ? (
          <img
            src={video.thumbnail}
            alt={video.title}
            className="max-h-full max-w-full object-contain select-none"
            onClick={handlePlayPause}
            style={{ cursor: "pointer" }}
          />
        ) : (
          <div className="flex flex-col items-center gap-3 cursor-wait">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white/80" />
            <p className="text-xs text-white/50">영상 불러오는 중...</p>
          </div>
        )}

        <PlayerOverlay isPlaying={isPlaying} showOverlay={showOverlay} onToggle={handlePlayPause} />

        {vibBuffering && (
          <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-black/60 pointer-events-none">
            <div className="flex gap-1.5 mb-3">
              <span className="h-2 w-2 rounded-full bg-[#7C3AED] animate-bounce [animation-delay:0ms]" />
              <span className="h-2 w-2 rounded-full bg-[#7C3AED] animate-bounce [animation-delay:150ms]" />
              <span className="h-2 w-2 rounded-full bg-[#7C3AED] animate-bounce [animation-delay:300ms]" />
            </div>
            <p className="text-xs font-medium text-white/80">진동 데이터 전송 중...</p>
          </div>
        )}


        {/* ── 자막 오버레이 ── */}
        {subtitleOn && currentSubtitle && (
          <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-1 pointer-events-none">
            {/* 감정 이모지 */}
            <div className="flex items-center gap-1.5 rounded-full bg-black/50 px-3 py-1 backdrop-blur-sm">
              <span className="text-base leading-none">
                {EMOTION_EMOJI[currentSubtitle.emotion] ?? "😐"}
              </span>
              <span className="text-[11px] font-medium text-white/80">
                {currentSubtitle.emotion.match(/\((.+?)\)/)?.[1] ?? currentSubtitle.emotion}
              </span>
              <span className="text-[10px] text-white/50">
                {currentSubtitle.confidence.toFixed(0)}%
              </span>
            </div>
            {/* 자막 텍스트 */}
            <div
              className="rounded-xl px-4 py-1.5 text-sm font-semibold text-white shadow-lg"
              style={{ background: "rgba(0,0,0,0.7)", textShadow: "0 1px 4px rgba(0,0,0,0.8)" }}
            >
              {currentSubtitle.text}
            </div>
          </div>
        )}

        {/* ── 효과음 오버레이 (상단 중앙, 원래 스타일) ── */}
        {emojiOn && (
          <div
            className="absolute top-5 left-1/2 -translate-x-1/2 z-30 pointer-events-none"
            style={{ visibility: activeOverlays.some(ao => ao.type === "sound") ? "visible" : "hidden" }}
          >
            {/* SVG distortion filter — 항상 DOM에 유지 */}
            <svg style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }}>
              <defs>
                <filter id="vp-glass-distortion" x="0%" y="0%" width="100%" height="100%" filterUnits="objectBoundingBox">
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
              </defs>
            </svg>

            <div
              className="relative flex overflow-hidden rounded-3xl"
              style={{ boxShadow: "0 6px 6px rgba(0,0,0,0.2), 0 0 20px rgba(0,0,0,0.1)" }}
            >
              {/* Glass Layers */}
              <div className="absolute inset-0 z-0 overflow-hidden rounded-3xl" style={{ backdropFilter: "blur(3px)", filter: "url(#vp-glass-distortion)", isolation: "isolate" }} />
              <div className="absolute inset-0 z-10 rounded-3xl" style={{ background: "rgba(255,255,255,0.18)" }} />
              <div className="absolute inset-0 z-20 rounded-3xl overflow-hidden" style={{ boxShadow: "inset 2px 2px 1px 0 rgba(255,255,255,0.5), inset -1px -1px 1px 1px rgba(255,255,255,0.5)" }} />
              
              <div className="relative z-30 flex items-center px-4 py-3">
                {activeOverlays.filter(ao => ao.type === "sound").map((ao, i) => {
                  const isActive = currentSec < ao.endSec;
                  const fadeProgress = isActive ? 0 : Math.min(1, (currentSec - ao.endSec) / 5);
                  return (
                    <span
                      key={`${ao.type}-${ao.eventId}`}
                      className="select-none leading-none transition-opacity duration-700"
                      style={{
                        fontSize: "2rem",
                        marginLeft: i === 0 ? 0 : "-0.5rem",
                        zIndex: i + 1,
                        position: "relative",
                        filter: "drop-shadow(0 2px 8px rgba(0,0,0,0.35))",
                        opacity: 1 - fadeProgress,
                        animationName: "emoji-bounce",
                        animationDuration: "1.4s",
                        animationTimingFunction: "ease-in-out",
                        animationIterationCount: "infinite",
                        animationDelay: `${i * 0.12}s`,
                        animationPlayState: isPlaying && isActive ? "running" : "paused",
                      }}
                    >
                      {ao.emoji}
                    </span>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* 전체화면 전용 사이드패널 */}
        {isFullscreen && (
          <div
            className={[
              "absolute right-0 top-0 bottom-0 z-30 flex transition-all duration-300 ease-in-out",
              showSidePanel ? "w-64" : "w-0",
              (showControls || showSidePanel) ? "opacity-100" : "opacity-0 pointer-events-none",
            ].join(" ")}
          >
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
              {showSidePanel ? <ChevronRight size={14} className="text-white/80" /> : <ChevronLeft size={14} className="text-white/80" />}
            </button>
            <div
              className="flex flex-1 flex-col overflow-hidden"
              style={{
                background: "rgba(15,23,42,0.75)",
                backdropFilter: "blur(24px) saturate(160%)",
                WebkitBackdropFilter: "blur(24px) saturate(160%)",
                borderLeft: "1px solid rgba(255,255,255,0.12)",
              }}
            >
              <div className="flex shrink-0 items-center gap-2 px-4 py-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
                <div className="h-2 w-2 rounded-full bg-[#10B981]" />
                <span className="text-sm font-semibold text-white">인식된 정보</span>
              </div>
              
              <div className="flex-1 overflow-y-auto">
                <div className="px-4 py-2.5 text-xs font-bold text-white/40 uppercase tracking-wider">소리 인식 결과</div>
                <div className="px-3 py-1 space-y-1">
                  {soundEvents.map((e) => (
                    <div
                      key={`sound-${e.id}`}
                      className={[
                        "flex items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] transition-colors",
                        currentSec >= e.start && currentSec < e.end
                          ? "bg-[#10B981]/20 text-[#6EE7B7]"
                          : "text-white/40",
                      ].join(" ")}
                    >
                      <span className="text-base">{getEmoji(e)}</span>
                      <span className="truncate">{getLabel(e)}</span>
                      <span className="ml-auto shrink-0 tabular-nums text-[11px] font-mono">{e.start.toFixed(1)}s</span>
                    </div>
                  ))}
                </div>

                <div className="mt-6 px-4 py-2.5 text-xs font-bold text-white/40 uppercase tracking-wider">음성 인식 결과</div>
                <div className="px-3 py-1 space-y-1">
                  {subtitles.map((s) => (
                    <div
                      key={`speech-${s.id}`}
                      className={[
                        "flex items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] transition-colors",
                        currentSec >= s.start && currentSec < s.end
                          ? "bg-[#3B82F6]/20 text-[#93C5FD]"
                          : "text-white/40",
                      ].join(" ")}
                    >
                      <span className="text-base">💬</span>
                      <span className="truncate">{s.text}</span>
                      <span className="ml-auto shrink-0 tabular-nums text-[11px] font-mono">{s.start.toFixed(1)}s</span>
                    </div>
                  ))}
                </div>
              </div>
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
          progressRef={progressRef}
          onProgressClick={handleProgressClick}
          onPlayPause={handlePlayPause}
          onSkip={handleSkip}
          onMuteToggle={() => setIsMuted((m) => !m)}
          onVolumeChange={(v) => { setVolume(v); setIsMuted(v === 0); }}
          onShowVolumeChange={setShowVolume}
          onReset={() => { if (videoRef.current) videoRef.current.currentTime = 0; setCurrentSec(0); }}
          soundEvents={soundEventDots}
          onSubtitleToggle={() => setSubtitleOn((v) => !v)}
          onEmojiToggle={() => setEmojiOn((v) => !v)}
          espStatus={espStatus}
          showControls={showControls}
          isFullscreen={isFullscreen}
          onFullscreen={handleFullscreen}
        />
      </div>
    </div>
  );
}
