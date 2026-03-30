// 효과음 이모지 + 리퀴드글라스 오버레이 — VideoPlayer와 EditPage에서 공유
type ActiveOverlay = {
  eventId: string | number;
  type: "sound" | "speech";
  emoji?: string;
  text?: string;
  endSec: number;
};

type Props = {
  overlays: ActiveOverlay[];
  currentSec: number;
  isPlaying: boolean;
};

export default function SoundEmojiOverlay({ overlays, currentSec, isPlaying }: Props) {
  const soundOverlays = overlays.filter((ao) => ao.type === "sound");
  if (soundOverlays.length === 0) return null;

  return (
    <>
      {/* SVG distortion filter */}
      <svg style={{ display: "none" }}>
        <filter id="sei-glass-distortion" x="0%" y="0%" width="100%" height="100%" filterUnits="objectBoundingBox">
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

      {/* Glass container */}
      <div
        className="relative flex overflow-hidden rounded-3xl"
        style={{
          boxShadow: "0 6px 6px rgba(0,0,0,0.2), 0 0 20px rgba(0,0,0,0.1)",
          transitionTimingFunction: "cubic-bezier(0.175, 0.885, 0.32, 2.2)",
        }}
      >
        {/* Glass Layer 1 — blur + distortion */}
        <div
          className="absolute inset-0 z-0 overflow-hidden rounded-3xl"
          style={{
            backdropFilter: "blur(3px)",
            filter: "url(#sei-glass-distortion)",
            isolation: "isolate",
          }}
        />
        {/* Glass Layer 2 — white tint */}
        <div
          className="absolute inset-0 z-10 rounded-3xl"
          style={{ background: "rgba(255,255,255,0.25)" }}
        />
        {/* Glass Layer 3 — inner border highlight */}
        <div
          className="absolute inset-0 z-20 overflow-hidden rounded-3xl"
          style={{
            boxShadow: "inset 2px 2px 1px 0 rgba(255,255,255,0.5), inset -1px -1px 1px 1px rgba(255,255,255,0.5)",
          }}
        />

        {/* Content */}
        <div className="relative z-30 flex items-end gap-3 px-6 pt-4 pb-3">
          {soundOverlays.map((ao, i) => {
            const isActive = currentSec < ao.endSec;
            const fadeProgress = isActive ? 0 : Math.min(1, Math.max(0, (currentSec - ao.endSec - 5) / 1));
            return (
              <div
                key={`${ao.type}-${ao.eventId}`}
                className="flex flex-col items-center transition-opacity duration-700"
                style={{ opacity: 1 - fadeProgress }}
              >
                <span
                  className="select-none leading-none"
                  style={{
                    fontSize: "3rem",
                    display: "block",
                    transformOrigin: "bottom center",
                    filter: "drop-shadow(0 2px 8px rgba(0,0,0,0.35))",
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
                <span className="text-[10px] font-medium text-white/80 leading-none tracking-wide drop-shadow mt-3">
                  {(ao.text ?? "").replace(/\s*소리\s*$/, "")}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
