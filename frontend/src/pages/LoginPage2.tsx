import { useEffect, useRef, useState } from "react";
import { kakaoLogin } from "../api/auth";
import LogoIcon from "../assets/images/LogoIcon.png";
import loginBeforeImage from "../assets/images/login(before).png";
import loginAfterImage from "../assets/images/login.png";
import kakaoLoginIcon from "../assets/icons/login_kakao.png";

function useScrollReveal() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { el.classList.add("revealed"); observer.disconnect(); } },
      { threshold: 0.15 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return ref;
}

function Reveal({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useScrollReveal();
  return (
    <div ref={ref} className={`reveal-section ${className}`} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}

export default function LoginPage2() {
  const [scrollOpacity, setScrollOpacity] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handleScroll = () => setScrollOpacity(Math.max(0, 1 - el.scrollTop / 120));
    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div ref={containerRef} className="lp2 w-full h-screen overflow-y-auto bg-[#F8FAFF]">

      {/* ── Hero ── */}
      <section className="relative flex min-h-screen flex-col items-center justify-center px-6 text-center overflow-hidden">
        <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse 80% 60% at 50% 0%, #DBEAFE 0%, transparent 70%), radial-gradient(ellipse 60% 40% at 80% 80%, #EDE9FE 0%, transparent 60%), #F8FAFF" }} />

        {/* 파동 배경 */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          {[1, 2, 3].map((n) => (
            <div key={n} className="absolute rounded-full border border-blue-200/40"
              style={{ width: `${n * 200}px`, height: `${n * 200}px`, animation: `ripple 4s ease-out ${n * 0.8}s infinite` }} />
          ))}
        </div>

        {/* 장식 점 */}
        <div className="pointer-events-none absolute top-20 left-16 w-3 h-3 rounded-full bg-blue-300/60 animate-ping" style={{ animationDuration: "3s" }} />
        <div className="pointer-events-none absolute top-40 right-24 w-2 h-2 rounded-full bg-violet-400/60 animate-ping" style={{ animationDuration: "4s", animationDelay: "1s" }} />
        <div className="pointer-events-none absolute bottom-32 left-24 w-2 h-2 rounded-full bg-orange-400/60 animate-ping" style={{ animationDuration: "3.5s", animationDelay: "0.5s" }} />
        <div className="pointer-events-none absolute bottom-48 right-16 w-3 h-3 rounded-full bg-blue-200/80 animate-ping" style={{ animationDuration: "5s", animationDelay: "2s" }} />

        {/* 로고 */}
        <div className="absolute top-5 left-6 flex items-center gap-3 z-10">
          <img src={LogoIcon} alt="" className="w-14 h-14" />
          <span className="text-2xl font-black tracking-wide text-slate-900">SoundView</span>
        </div>

        {/* 캐릭터 */}
        <div className="relative z-10 mb-6" style={{ animation: "walkIn 1.2s cubic-bezier(0.22, 1, 0.36, 1) both" }}>
          <div className="absolute inset-0 rounded-full bg-blue-400/15 blur-3xl scale-[3]" />
          <div className="absolute inset-0 rounded-full bg-cyan-300/10 blur-2xl scale-[2] animate-pulse" style={{ animationDuration: "4s" }} />
          {[0, 0.7, 1.4].map((delay, i) => (
            <div key={i} className="absolute inset-0 rounded-full"
              style={{ border: `${2 - i * 0.5}px solid rgba(59,130,246,${0.5 - i * 0.12})`, animation: `sonicRing 2.4s cubic-bezier(0.2,0.6,0.4,1) ${delay}s infinite` }} />
          ))}
          <div className="absolute top-0 right-4 w-2.5 h-2.5 rounded-full bg-yellow-300" style={{ animation: "sparkle 2.5s ease-in-out infinite" }} />
          <div className="absolute top-8 -left-2 w-2 h-2 rounded-full bg-blue-300" style={{ animation: "sparkle 3s ease-in-out 0.7s infinite" }} />
          <div className="absolute bottom-6 right-0 w-1.5 h-1.5 rounded-full bg-violet-400" style={{ animation: "sparkle 2.8s ease-in-out 1.2s infinite" }} />
          <div className="absolute bottom-2 left-6 w-2 h-2 rounded-full bg-orange-300" style={{ animation: "sparkle 3.2s ease-in-out 0.3s infinite" }} />
          <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-36 h-5 rounded-full bg-blue-400/20 blur-lg" style={{ animation: "shadowPulse 3.5s ease-in-out infinite" }} />
          <img src={LogoIcon} alt="SoundView 캐릭터" className="relative w-48 h-48 sm:w-64 sm:h-64"
            style={{ animation: "walkIn 1.2s cubic-bezier(0.22, 1, 0.36, 1) both, floatBob 3.5s ease-in-out 1.2s infinite", filter: "drop-shadow(0 10px 30px rgba(59,130,246,0.35))" }} />
        </div>

        {/* 서비스명 + 슬로건 */}
        <div className="relative z-10">
          <h1 className="text-5xl sm:text-6xl font-black text-slate-800" style={{ animation: "fadeUp 0.8s ease both", letterSpacing: "-0.01em" }}>
            Sound<span className="bg-clip-text text-transparent" style={{ backgroundImage: "linear-gradient(135deg, #3B82F6 0%, #8B5CF6 100%)" }}>View</span>
          </h1>

          <div className="mt-4 flex items-center justify-center gap-3 flex-wrap" style={{ animation: "fadeUp 0.8s ease 0.15s both" }}>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-4 py-1.5 text-sm font-bold text-blue-600">👁️ 시각으로</span>
            <span className="text-slate-300 font-light">+</span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-orange-100 px-4 py-1.5 text-sm font-bold text-orange-600" style={{ animation: "vibrateTag 0.4s ease-in-out 2s 3" }}>📳 촉각으로</span>
            <span className="text-slate-300 font-light">=</span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-100 px-4 py-1.5 text-sm font-bold text-violet-600">🎧 소리를 느끼다</span>
          </div>

          <p className="mt-3 text-sm text-slate-400 tracking-wide" style={{ animation: "fadeUp 0.8s ease 0.25s both" }}>
            청각장애인을 위한 영상 경험 서비스
          </p>

          <div style={{ animation: "fadeUp 0.8s ease 0.35s both" }}>
            <button type="button" onClick={() => kakaoLogin()}
              className="mt-8 inline-flex h-[52px] items-center gap-2.5 rounded-full bg-[#F7E548] px-8 text-[15px] font-bold text-[#2A1D00] transition-all hover:scale-105 active:scale-100"
              style={{ boxShadow: "0 8px 30px rgba(247,229,72,0.4)" }}>
              <img src={kakaoLoginIcon} alt="" className="w-5 h-5" />
              카카오로 시작하기
            </button>
          </div>
        </div>

        {/* 스크롤 힌트 */}
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5 text-slate-400 animate-bounce pointer-events-none z-50 transition-opacity duration-300"
          style={{ opacity: scrollOpacity }}>
          <span className="text-[10px] tracking-widest uppercase font-medium">Scroll</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M12 5v14M5 12l7 7 7-7" />
          </svg>
        </div>
      </section>

      {/* ── Before / After ── */}
      <section className="px-6 py-24 flex flex-col items-center gap-14 overflow-hidden max-w-5xl mx-auto w-full">
        <Reveal className="text-center w-full">
          <span className="inline-block rounded-full bg-blue-100 px-4 py-1.5 text-xs font-bold text-blue-500 tracking-widest uppercase mb-5">Before & After</span>
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-700">소리가 보이기 시작합니다</h2>
          <p className="mt-3 text-slate-400 text-sm max-w-md mx-auto leading-relaxed">
            SoundView를 사용하면 영상 속 모든 소리를 눈으로 확인할 수 있어요.
          </p>
        </Reveal>

        <div className="flex flex-col sm:flex-row items-stretch gap-6 w-full max-w-4xl">
          {/* Before */}
          <Reveal delay={100} className="flex-1 w-full">
            <div className="flex flex-col gap-3 h-full">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-400 tracking-widest uppercase">
                <span className="w-2 h-2 rounded-full bg-slate-300 inline-block" />Before
              </span>
              <div className="relative rounded-2xl overflow-hidden shadow-lg flex-1"
                style={{ filter: "grayscale(0.8) brightness(0.75)", minHeight: 180 }}>
                <img src={loginBeforeImage} alt="SoundView 사용 전" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
                <div className="absolute bottom-4 left-4 flex items-center gap-2">
                  <span className="rounded-full bg-black/50 backdrop-blur-md px-3 py-1 text-[11px] text-white/60 font-medium">소리 없음</span>
                  <span className="rounded-full bg-black/50 backdrop-blur-md px-3 py-1 text-[11px] text-white/60 font-medium">자막 없음</span>
                </div>
              </div>
            </div>
          </Reveal>

          {/* 화살표 */}
          <Reveal delay={150} className="shrink-0 flex items-center justify-center">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white border border-slate-200 shadow-lg text-slate-400 font-bold text-lg">→</div>
          </Reveal>

          {/* After */}
          <Reveal delay={200} className="flex-1 w-full">
            <div className="flex flex-col gap-3 h-full">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-500 tracking-widest uppercase">
                <span className="w-2 h-2 rounded-full bg-blue-400 inline-block animate-pulse" />After
              </span>
              <div className="relative rounded-2xl overflow-hidden shadow-xl flex-1"
                style={{ boxShadow: "0 8px 40px rgba(59,130,246,0.25)", minHeight: 180 }}>
                <img src={loginAfterImage} alt="SoundView 사용 후" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-blue-900/30 via-transparent to-transparent" />
                <div className="absolute bottom-4 left-4 flex items-center gap-2">
                  <span className="rounded-full bg-blue-500/80 backdrop-blur-md px-3 py-1 text-[11px] text-white font-semibold">AI 자막 활성</span>
                  <span className="rounded-full bg-blue-500/80 backdrop-blur-md px-3 py-1 text-[11px] text-white font-semibold">환경음 인식</span>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="relative flex flex-col items-center gap-8 px-6 py-24 text-center overflow-hidden">
        <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse 70% 60% at 50% 50%, #DBEAFE 0%, #F5F3FF 60%, #F8FAFF 100%)" }} />
        <Reveal className="relative z-10 flex flex-col items-center gap-7 w-full">
          <img src={LogoIcon} alt="SoundView 캐릭터" className="w-24 h-24"
            style={{ animation: "floatBob 3.5s ease-in-out infinite", filter: "drop-shadow(0 10px 30px rgba(59,130,246,0.3))" }} />
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-700">지금 바로 시작해보세요</h2>
          <p className="text-slate-400 max-w-xs leading-relaxed text-sm">
            카카오 계정 하나로 간편하게 가입하고<br />무료로 모든 기능을 이용하세요.
          </p>
          <button type="button" onClick={() => kakaoLogin()}
            className="flex h-[52px] items-center gap-2.5 rounded-full bg-[#F7E548] px-8 text-[15px] font-bold text-[#2A1D00] transition-all hover:scale-105 active:scale-100"
            style={{ boxShadow: "0 8px 30px rgba(247,229,72,0.4)" }}>
            <img src={kakaoLoginIcon} alt="" className="w-5 h-5" />
            카카오로 시작하기
          </button>
          <p className="text-xs text-slate-300">© 2026 SoundView. All rights reserved.</p>
        </Reveal>
      </section>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800;900&display=swap');
        .lp2 { font-family: 'Nunito', sans-serif; }
        .lp2 h1, .lp2 h2, .lp2 h3 { font-family: 'Nunito', sans-serif; }

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
        @keyframes ripple {
          0%   { opacity: 0.5; transform: scale(0.5); }
          100% { opacity: 0;   transform: scale(2.5); }
        }
        @keyframes vibrateTag {
          0%, 100% { transform: translateX(0); }
          20%       { transform: translateX(-3px) rotate(-1deg); }
          40%       { transform: translateX(3px) rotate(1deg); }
          60%       { transform: translateX(-2px); }
          80%       { transform: translateX(2px); }
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
