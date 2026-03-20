// 로그인 페이지 v2 — 캐릭터 중심 서비스 소개
import { useEffect, useRef } from "react";
import { kakaoLogin } from "../api/auth";
import LogoIcon from "../assets/images/LogoIcon.png";
import loginBeforeImage from "../assets/images/login(before).png";
import loginAfterImage from "../assets/images/login.png";

const FEATURES = [
  {
    emoji: "👁️",
    title: "시각으로 듣는다",
    desc: "환경음과 대화를 실시간 텍스트·자막으로 변환해 화면에서 바로 확인해요.",
    color: "#3B82F6",
    lightBg: "#EFF6FF",
    tag: "Visual",
    vibrate: false,
  },
  {
    emoji: "📳",
    title: "촉각으로 듣는다",
    desc: "소리의 크기와 리듬을 진동으로 전달해 온몸으로 소리를 느껴요.",
    color: "#F97316",
    lightBg: "#FFF7ED",
    tag: "Haptic",
    vibrate: true,
  },
  {
    emoji: "💬",
    title: "대화 자막",
    desc: "영상 속 목소리를 정확한 자막으로 변환해 대화를 놓치지 않아요.",
    color: "#10B981",
    lightBg: "#ECFDF5",
    tag: "Caption",
    vibrate: false,
  },
  {
    emoji: "🎞️",
    title: "공유 앨범",
    desc: "소중한 순간을 친구·가족과 함께 나누고 이모지로 함께 반응해요.",
    color: "#8B5CF6",
    lightBg: "#F5F3FF",
    tag: "Album",
    vibrate: false,
  },
];

function useScrollReveal() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) { el.classList.add("revealed"); observer.disconnect(); }
      },
      { threshold: 0.15 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return ref;
}

function RevealSection({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useScrollReveal();
  return (
    <div ref={ref} className={`reveal-section ${className}`} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}

export default function LoginPage2() {
  return (
    <div className="lp2 w-full h-screen overflow-y-auto bg-[#F8FAFF]">

      {/* ── Hero 섹션 ── */}
      <section className="relative flex min-h-screen flex-col items-center justify-center px-6 text-center overflow-hidden">
        <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse 80% 60% at 50% 0%, #DBEAFE 0%, transparent 70%), radial-gradient(ellipse 60% 40% at 80% 80%, #EDE9FE 0%, transparent 60%), #F8FAFF" }} />

        {/* 진동 파동 배경 — 중앙에서 퍼지는 물결 */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          {[1,2,3].map((n) => (
            <div key={n} className="absolute rounded-full border border-blue-200/30"
              style={{ width: `${n * 180}px`, height: `${n * 180}px`, animation: `ripple 4s ease-out ${n * 0.8}s infinite` }} />
          ))}
        </div>

        {/* 핑 장식 */}
        <div className="pointer-events-none absolute top-20 left-16 w-3 h-3 rounded-full bg-blue-300/60 animate-ping" style={{ animationDuration: "3s" }} />
        <div className="pointer-events-none absolute top-40 right-24 w-2 h-2 rounded-full bg-violet-400/60 animate-ping" style={{ animationDuration: "4s", animationDelay: "1s" }} />
        <div className="pointer-events-none absolute bottom-32 left-24 w-2 h-2 rounded-full bg-orange-400/60 animate-ping" style={{ animationDuration: "3.5s", animationDelay: "0.5s" }} />
        <div className="pointer-events-none absolute bottom-48 right-16 w-3 h-3 rounded-full bg-blue-200/80 animate-ping" style={{ animationDuration: "5s", animationDelay: "2s" }} />

        {/* 상단 로고 */}
        <div className="absolute top-6 left-8 flex items-center gap-2 z-10">
          <img src={LogoIcon} alt="" className="w-8 h-8" />
          <span className="text-sm font-bold text-slate-400 tracking-widest uppercase">SoundView</span>
        </div>

        {/* 캐릭터 */}
        <div className="relative z-10 mb-6" style={{ animation: "walkIn 1.2s cubic-bezier(0.22, 1, 0.36, 1) both" }}>
          <div className="absolute inset-0 rounded-full bg-blue-400/15 blur-3xl scale-[3]" />
          <div className="absolute inset-0 rounded-full bg-cyan-300/10 blur-2xl scale-[2] animate-pulse" style={{ animationDuration: "4s" }} />
          {/* 소리 파동 링 — 3겹 */}
          {[0, 0.7, 1.4].map((delay, i) => (
            <div
              key={i}
              className="absolute inset-0 rounded-full"
              style={{
                border: `${2 - i * 0.5}px solid rgba(59,130,246,${0.5 - i * 0.12})`,
                animation: `sonicRing 2.4s cubic-bezier(0.2,0.6,0.4,1) ${delay}s infinite`,
              }}
            />
          ))}
          <div className="absolute top-0 right-4 w-2.5 h-2.5 rounded-full bg-yellow-300" style={{ animation: "sparkle 2.5s ease-in-out infinite" }} />
          <div className="absolute top-8 -left-2 w-2 h-2 rounded-full bg-blue-300" style={{ animation: "sparkle 3s ease-in-out 0.7s infinite" }} />
          <div className="absolute bottom-6 right-0 w-1.5 h-1.5 rounded-full bg-violet-400" style={{ animation: "sparkle 2.8s ease-in-out 1.2s infinite" }} />
          <div className="absolute bottom-2 left-6 w-2 h-2 rounded-full bg-orange-300" style={{ animation: "sparkle 3.2s ease-in-out 0.3s infinite" }} />
          <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-36 h-5 rounded-full bg-blue-400/20 blur-lg" style={{ animation: "shadowPulse 3.5s ease-in-out infinite" }} />
          <img
            src={LogoIcon}
            alt="SoundView 캐릭터"
            className="relative w-64 h-64 sm:w-80 sm:h-80"
            style={{
              animation: "walkIn 1.2s cubic-bezier(0.22, 1, 0.36, 1) both, floatBob 3.5s ease-in-out 1.2s infinite",
              filter: "drop-shadow(0 10px 30px rgba(59,130,246,0.35)) drop-shadow(0 0 60px rgba(59,130,246,0.15))",
            }}
          />
        </div>

        {/* 서비스명 + 슬로건 */}
        <div className="relative z-10">
          <h1 className="text-5xl sm:text-7xl font-black tracking-tight text-slate-800" style={{ animation: "fadeUp 0.8s ease both" }}>
            Sound<span className="bg-clip-text text-transparent" style={{ backgroundImage: "linear-gradient(135deg, #3B82F6 0%, #8B5CF6 100%)" }}>View</span>
          </h1>

          {/* 핵심 메시지 — 시각 + 촉각 */}
          <div className="mt-5 flex items-center justify-center gap-3 flex-wrap" style={{ animation: "fadeUp 0.8s ease 0.15s both" }}>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-4 py-1.5 text-sm font-bold text-blue-600">
              👁️ 시각으로
            </span>
            <span className="text-slate-300 font-light">+</span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-orange-100 px-4 py-1.5 text-sm font-bold text-orange-600" style={{ animation: "vibrateTag 0.4s ease-in-out 2s 3" }}>
              📳 촉각으로
            </span>
            <span className="text-slate-300 font-light">=</span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-100 px-4 py-1.5 text-sm font-bold text-violet-600">
              🎧 소리를 느끼다
            </span>
          </div>

          <p className="mt-4 text-sm text-slate-400 tracking-wide" style={{ animation: "fadeUp 0.8s ease 0.25s both" }}>
            청각장애인을 위한 영상 경험 서비스
          </p>

          <div style={{ animation: "fadeUp 0.8s ease 0.35s both" }}>
            <button
              type="button"
              onClick={() => kakaoLogin()}
              className="mt-8 inline-flex h-[52px] items-center gap-2.5 rounded-full bg-[#F7E548] px-8 text-[15px] font-bold text-[#2A1D00] transition-all hover:scale-105 active:scale-100"
              style={{ boxShadow: "0 8px 30px rgba(247,229,72,0.4)" }}
            >
              <span className="text-[18px]">💬</span>
              카카오로 시작하기
            </button>
          </div>
        </div>

        <div className="absolute bottom-8 flex flex-col items-center gap-1.5 text-slate-400 animate-bounce pointer-events-none z-10">
          <span className="text-[10px] tracking-widest uppercase font-medium">Scroll</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M12 5v14M5 12l7 7 7-7" />
          </svg>
        </div>
      </section>

      {/* ── Before / After 섹션 ── */}
      <section className="px-6 py-28 flex flex-col items-center gap-16 overflow-hidden max-w-6xl mx-auto w-full">
        <RevealSection className="text-center w-full">
          <span className="inline-block rounded-full bg-blue-100 px-4 py-1.5 text-xs font-bold text-blue-500 tracking-widest uppercase mb-5">Before & After</span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-800">소리가 보이기 시작합니다</h2>
          <p className="mt-3 text-slate-400 text-sm max-w-md mx-auto leading-relaxed">
            SoundView를 사용하면 영상 속 모든 소리를 눈으로 확인할 수 있어요.
          </p>
        </RevealSection>

        <div className="flex flex-col sm:flex-row items-center gap-8 w-full max-w-5xl">
          <RevealSection delay={100} className="flex-1 w-full">
            <div className="flex flex-col gap-3">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-400 tracking-widest uppercase">
                <span className="w-2 h-2 rounded-full bg-slate-300 inline-block" />Before
              </span>
              <div className="relative rounded-2xl overflow-hidden shadow-xl hover:shadow-2xl transition-shadow duration-300">
                <img src={loginBeforeImage} alt="SoundView 사용 전" className="w-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />
                <div className="absolute bottom-4 left-4 flex items-center gap-2">
                  <span className="rounded-full bg-black/50 backdrop-blur-md px-3 py-1 text-[11px] text-white/70 font-medium">소리 없음</span>
                  <span className="rounded-full bg-black/50 backdrop-blur-md px-3 py-1 text-[11px] text-white/70 font-medium">자막 없음</span>
                </div>
              </div>
            </div>
          </RevealSection>

          <RevealSection delay={150} className="shrink-0">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white border border-slate-200 shadow-lg text-slate-400 font-bold text-lg">→</div>
          </RevealSection>

          <RevealSection delay={200} className="flex-1 w-full">
            <div className="flex flex-col gap-3">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-500 tracking-widest uppercase">
                <span className="w-2 h-2 rounded-full bg-blue-400 inline-block" />After
              </span>
              <div className="relative rounded-2xl overflow-hidden shadow-xl hover:shadow-2xl transition-shadow duration-300" style={{ boxShadow: "0 8px 40px rgba(59,130,246,0.2)" }}>
                <img src={loginAfterImage} alt="SoundView 사용 후" className="w-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-blue-900/40 via-transparent to-transparent" />
                <div className="absolute bottom-4 left-4 flex items-center gap-2">
                  <span className="rounded-full bg-blue-500/80 backdrop-blur-md px-3 py-1 text-[11px] text-white font-semibold">AI 자막 활성</span>
                  <span className="rounded-full bg-blue-500/80 backdrop-blur-md px-3 py-1 text-[11px] text-white font-semibold">환경음 인식</span>
                </div>
              </div>
            </div>
          </RevealSection>
        </div>
      </section>

      {/* ── 기능 소개 섹션 ── */}
      <section className="px-6 py-28 flex flex-col items-center gap-16 max-w-5xl mx-auto">
        <RevealSection className="text-center w-full">
          <span className="inline-block rounded-full bg-violet-100 px-4 py-1.5 text-xs font-bold text-violet-500 tracking-widest uppercase mb-5">Features</span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-800">주요 기능</h2>
          <p className="mt-3 text-slate-400 text-sm">SoundView와 함께라면 소리가 없어도 괜찮아요</p>
        </RevealSection>

        <div className="flex flex-col gap-5 w-full">
          {FEATURES.map(({ emoji, title, desc, color, lightBg, tag, vibrate }, i) => (
            <RevealSection key={title} delay={i * 80}>
              <div
                className="group flex items-center gap-6 sm:gap-10 rounded-2xl px-8 py-7 hover:-translate-y-0.5 transition-all duration-300 cursor-default relative overflow-hidden"
                style={{
                  background: `linear-gradient(135deg, ${lightBg} 0%, #ffffff 100%)`,
                  boxShadow: `0 2px 20px ${color}14, 0 1px 4px rgba(0,0,0,0.04)`,
                  borderLeft: `4px solid ${color}`,
                }}
              >
                {/* 진동 카드 전용 — 배경 파동 */}
                {vibrate && (
                  <>
                    <div className="absolute inset-0 rounded-2xl border-2 border-orange-300/0 group-hover:border-orange-300/40 transition-all duration-300" style={{ animation: "vibrateCard 0.3s ease-in-out infinite" }} />
                    <div className="pointer-events-none absolute right-6 top-1/2 -translate-y-1/2 flex gap-1.5 opacity-20 group-hover:opacity-60 transition-opacity">
                      {[1,2,3,4,5].map((n) => (
                        <div key={n} className="w-0.5 rounded-full bg-orange-400"
                          style={{ height: `${8 + Math.sin(n) * 10}px`, animation: `soundBar 0.8s ease-in-out ${n * 0.12}s infinite alternate` }} />
                      ))}
                    </div>
                  </>
                )}

                <span className="hidden sm:flex shrink-0 w-10 h-10 rounded-full items-center justify-center text-sm font-black" style={{ background: `${color}15`, color }}>
                  {String(i + 1).padStart(2, "0")}
                </span>

                <div
                  className="shrink-0 w-14 h-14 rounded-2xl flex items-center justify-center text-3xl transition-transform duration-300 group-hover:scale-110"
                  style={{
                    background: `${color}12`,
                    animation: vibrate ? "vibrateEmoji 2s ease-in-out infinite" : undefined,
                  }}
                >
                  {emoji}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-base font-extrabold text-slate-800">{title}</h3>
                    {vibrate && (
                      <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-bold text-orange-500 tracking-wide">HAPTIC</span>
                    )}
                  </div>
                  <p className="text-sm text-slate-400 leading-relaxed">{desc}</p>
                </div>

                <div className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 -translate-x-2 group-hover:translate-x-0" style={{ background: `${color}18`, color }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </RevealSection>
          ))}
        </div>
      </section>

      {/* ── CTA 섹션 ── */}
      <section className="relative flex flex-col items-center gap-8 px-6 py-28 text-center overflow-hidden">
        <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse 70% 60% at 50% 50%, #DBEAFE 0%, #F5F3FF 60%, #F8FAFF 100%)" }} />
        <RevealSection className="relative z-10 flex flex-col items-center gap-7 w-full">
          <img src={LogoIcon} alt="SoundView 캐릭터" className="w-28 h-28"
            style={{ animation: "floatBob 3.5s ease-in-out infinite", filter: "drop-shadow(0 10px 30px rgba(59,130,246,0.3))" }} />
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-800">지금 바로 시작해보세요</h2>
          <p className="text-slate-400 max-w-xs leading-relaxed text-sm">
            카카오 계정 하나로 간편하게 가입하고<br />무료로 모든 기능을 이용하세요.
          </p>
          <button type="button" onClick={() => kakaoLogin()}
            className="flex h-[52px] items-center gap-2.5 rounded-full bg-[#F7E548] px-8 text-[15px] font-bold text-[#2A1D00] transition-all hover:scale-105 active:scale-100"
            style={{ boxShadow: "0 8px 30px rgba(247,229,72,0.4)" }}>
            <span className="text-[18px]">💬</span>
            카카오로 시작하기
          </button>
          <p className="text-xs text-slate-300">© 2025 SoundView. All rights reserved.</p>
        </RevealSection>
      </section>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800;900&family=DM+Sans:wght@400;500;600&display=swap');
        .lp2 { font-family: 'DM Sans', sans-serif; }
        .lp2 h1, .lp2 h2, .lp2 h3 { font-family: 'Sora', sans-serif; }

        @keyframes walkIn {
          0%   { opacity: 0; transform: translateY(80px) scale(0.7); }
          40%  { opacity: 1; transform: translateY(-12px) scale(1.04); }
          60%  { transform: translateY(6px) scale(0.98); }
          75%  { transform: translateY(-6px) scale(1.01); }
          88%  { transform: translateY(2px) scale(0.995); }
          100% { opacity: 1; transform: translateY(0px) scale(1); }
        }
        @keyframes floatBob {
          0%, 100% { transform: translateY(0px); }
          50%      { transform: translateY(-14px); }
        }
        /* 소리 파동 — 안에서 밖으로 퍼지며 사라짐 */
        @keyframes sonicRing {
          0%   { transform: scale(1);   opacity: 0.8; }
          100% { transform: scale(2.6); opacity: 0; }
        }
        @keyframes sparkle {
          0%, 100% { opacity: 0; transform: scale(0.5) translateY(0px); }
          30%       { opacity: 1; transform: scale(1.2) translateY(-6px); }
          60%       { opacity: 0.6; transform: scale(0.8) translateY(-10px); }
        }
        @keyframes shadowPulse {
          0%, 100% { transform: translateX(-50%) scaleX(1);   opacity: 0.3; }
          50%       { transform: translateX(-50%) scaleX(0.6); opacity: 0.15; }
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        /* 중앙에서 퍼지는 물결 */
        @keyframes ripple {
          0%   { opacity: 0.5; transform: scale(0.5); }
          100% { opacity: 0;   transform: scale(2.5); }
        }
        /* 촉각 태그 진동 */
        @keyframes vibrateTag {
          0%, 100% { transform: translateX(0); }
          20%       { transform: translateX(-3px) rotate(-1deg); }
          40%       { transform: translateX(3px) rotate(1deg); }
          60%       { transform: translateX(-2px); }
          80%       { transform: translateX(2px); }
        }
        /* 진동 카드 이모지 */
        @keyframes vibrateEmoji {
          0%, 90%, 100% { transform: translateX(0) rotate(0deg); }
          92%            { transform: translateX(-3px) rotate(-4deg); }
          94%            { transform: translateX(3px) rotate(4deg); }
          96%            { transform: translateX(-2px) rotate(-2deg); }
          98%            { transform: translateX(2px) rotate(2deg); }
        }
        /* 사운드 바 */
        @keyframes soundBar {
          from { transform: scaleY(0.4); }
          to   { transform: scaleY(1.4); }
        }
        .reveal-section {
          opacity: 0;
          transform: translateY(32px);
          transition: opacity 0.7s ease, transform 0.7s ease;
        }
        .reveal-section.revealed {
          opacity: 1;
          transform: translateY(0);
        }
      `}</style>
    </div>
  );
}
