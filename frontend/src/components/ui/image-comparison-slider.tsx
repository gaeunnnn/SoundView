import { useEffect, useRef, useState } from "react";

interface ImageComparisonProps {
  beforeImage: string;
  afterImage: string;
  altBefore?: string;
  altAfter?: string;
  delay?: number;
  duration?: number;
  holdAfter?: number;
  reverseDuration?: number;
  onPosChange?: (pos: number) => void;
}

export function ImageComparison({
  beforeImage,
  afterImage,
  altBefore = "Before",
  altAfter = "After",
  delay = 2200,
  duration = 3500,
  holdAfter = 2800,
  reverseDuration = 900,
  onPosChange,
}: ImageComparisonProps) {
  const [pos, setPos] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    let startTime: number | null = null;
    let phase: "wait" | "forward" | "hold" | "back" = "wait";
    let holdStart: number | null = null;
    let backStart: number | null = null;
    let delayStart: number | null = null;

    const tick = (now: number) => {
      if (phase === "wait") {
        if (!delayStart) delayStart = now;
        if (now - delayStart >= delay) { phase = "forward"; startTime = now; }
      } else if (phase === "forward") {
        const t = Math.min((now - startTime!) / duration, 1);
        const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
        const newPos = eased * 100;
        setPos(newPos);
        onPosChange?.(newPos);
        if (t >= 1) { phase = "hold"; holdStart = now; }
      } else if (phase === "hold") {
        if (now - holdStart! >= holdAfter) { phase = "back"; backStart = now; }
      } else if (phase === "back") {
        const t = Math.min((now - backStart!) / reverseDuration, 1);
        const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
        const newPos = (1 - eased) * 100;
        setPos(newPos);
        onPosChange?.(newPos);
        if (t >= 1) { phase = "wait"; delayStart = null; startTime = null; }
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [delay, duration, holdAfter, reverseDuration, onPosChange]);

  return (
    <div className="relative w-full select-none overflow-hidden rounded-2xl"
      style={{ boxShadow: "0 24px 64px rgba(30,158,244,0.15), 0 4px 16px rgba(0,0,0,0.08)" }}>

      {/* Before */}
      <img src={beforeImage} alt={altBefore} className="block w-full object-cover" draggable={false}
        style={{ filter: "grayscale(1) brightness(0.55) contrast(0.9)", opacity: 0.75 }} />

      {/* After */}
      <div className="absolute inset-0 overflow-hidden" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}>
        <img src={afterImage} alt={altAfter} className="absolute inset-0 w-full h-full object-cover" draggable={false} />
      </div>

      {/* 경계 라인 */}
      {pos > 0 && pos < 100 && (
        <div className="absolute top-0 bottom-0 pointer-events-none"
          style={{ left: `${pos}%`, transform: "translateX(-50%)", width: 2, background: "rgba(255,255,255,0.75)" }}>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center rounded-full bg-white"
            style={{ width: 32, height: 32, boxShadow: "0 2px 12px rgba(0,0,0,0.25)" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1E9EF4" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 6l-6 6 6 6M16 6l6 6-6 6" />
            </svg>
          </div>
        </div>
      )}

      {/* Before 레이블 */}
      <div className="absolute top-3 left-4 rounded-full bg-black/35 backdrop-blur-sm px-3 py-1 text-[11px] font-bold text-white/70 pointer-events-none">
        Before
      </div>

      {/* After 레이블 */}
      {pos > 15 && (
        <div className="absolute top-3 right-4 rounded-full backdrop-blur-sm px-3 py-1 text-[11px] font-bold text-white pointer-events-none"
          style={{ background: "rgba(30,158,244,0.85)", opacity: Math.min(1, (pos - 15) / 20), transition: "opacity 0.3s" }}>
          After
        </div>
      )}
    </div>
  );
}
