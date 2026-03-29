import { useState, useEffect, useRef, useMemo } from "react";
import { kakaoLogin } from "../api/auth";
import LogoIcon from "../assets/images/LogoIcon.png";
import baseImage from "../assets/images/image.png";
import kakaoLoginIcon from "../assets/icons/login_kakao.png";

export default function LoginPage() {
  const [scrollProgress, setScrollProgress] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const stickyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handleScroll = () => {
      if (!stickyRef.current) return;
      const rect = stickyRef.current.getBoundingClientRect();
      const progress = Math.min(1, Math.max(0, (el.scrollTop - (rect.top + el.scrollTop)) / (rect.height - window.innerHeight)));
      setScrollProgress(progress);
    };
    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, []);

  // 💥 자막 데이터
  const burstCaptions = useMemo(() => [
    { text: "정말 대단해요!", emoji: "🤩", x: -70, y: -60, rot: -20, delay: 0.15, color: "#3B82F6" },
    { text: "🎷 [재즈 선율]", emoji: "", x: 75, y: -55, rot: 25, delay: 0.25, color: "#F59E0B" },
    { text: "🐦 [지저귀는 소리]", emoji: "", x: -80, y: 10, rot: -10, delay: 0.2, color: "#10B981" },
    { text: "🎻 [오케스트라]", emoji: "", x: 10, y: -80, rot: 5, delay: 0.35, color: "#8B5CF6" },
    { text: "👏 [박수 소리]", emoji: "", x: 80, y: 25, rot: 35, delay: 0.3, color: "#EC4899" },
    { text: "정말 감동적입니다", emoji: "😭", x: -75, y: -25, rot: -30, delay: 0.4, color: "#FF4D4D" },
  ], []);

  // ── 수치 계산 ──
  const scale = 0.6 + (scrollProgress * 0.2);
  const wipePos = Math.min(1, scrollProgress / 0.8) * 100;
  const shiftProgress = Math.pow(Math.max(0, (scrollProgress - 0.85) / 0.15), 1.2); 
  const translateX = shiftProgress * -320;
  
  const burstOpacity = Math.min(1, Math.max(0, (0.95 - scrollProgress) * 20));
  const finalContentOpacity = Math.max(0, (scrollProgress - 0.9) * 10);

  return (
    <div ref={containerRef} className="lp-ultimate-refined-compact w-full h-screen overflow-y-auto overflow-x-hidden bg-white scroll-smooth">
      
      {/* ── Section 1: Hero ── */}
      <section className="relative h-screen w-full flex flex-col items-center justify-center text-center px-6 z-10">
        <div className="absolute inset-0" style={{ background: "radial-gradient(circle at 50% 50%, #F0F9FF 0%, #FFFFFF 100%)" }} />
        {/* 초음파 이펙트 */}
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
          {[0, 1, 2, 3].map(n => (
            <div key={n} className="absolute rounded-full border-[3px] border-blue-400/40"
              style={{
                width: '120px', height: '120px',
                animation: `heroRipple 2.8s cubic-bezier(0.2,0.6,0.4,1) ${n * 0.65}s infinite`,
              }} />
          ))}
        </div>
        <div className="relative z-10 space-y-6" style={{ animation: "fadeUp 1.2s ease both" }}>
          <img src={LogoIcon} alt="Logo" className="w-28 h-28 mx-auto drop-shadow-xl" />
          <div className="space-y-3">
            <h1 className="text-6xl sm:text-8xl font-[1000] text-slate-900 tracking-tighter leading-none">
              Sound<span className="text-blue-500 italic">View</span>
            </h1>
            <p className="text-slate-500 text-xl sm:text-3xl font-[900] tracking-tight">
              소리를 <span className="text-blue-500">눈</span>과 <span className="text-blue-500">손</span>으로 느끼다
            </p>
          </div>
        </div>
        {/* 스크롤 다운 표시 */}
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2" style={{ animation: "fadeUp 1.2s ease 0.6s both" }}>
          <span className="text-slate-400 text-sm font-semibold tracking-widest uppercase">Scroll Down</span>
          <div className="w-6 h-10 rounded-full border-2 border-slate-300 flex items-start justify-center p-1">
            <div className="w-1.5 h-2.5 bg-slate-400 rounded-full" style={{ animation: "scrollDot 1.8s ease-in-out infinite" }} />
          </div>
        </div>
      </section>

      {/* ── Section 2: Awakening Build-up ── */}
      <section ref={stickyRef} className="relative h-[900vh] w-full bg-white">
        <div className="sticky top-0 h-screen w-full flex items-center justify-center overflow-hidden">
          
          <div className="absolute inset-0 transition-all duration-1000 -z-10"
            style={{ background: `radial-gradient(circle at 50% 50%, rgba(186, 230, 253, ${scrollProgress * 0.7}) 0%, #FFFFFF 100%)` }} />

          {/* 💻 메인 통합 컨테이너 💻 */}
          <div className="relative w-full max-w-[1400px] h-full flex items-center justify-center overflow-visible">
            
            {/* 1. 모니터 */}
            <div className="relative shrink-0 transition-transform duration-75 ease-out flex items-center justify-center"
              style={{
                width: '100%',
                maxWidth: '740px',
                transform: `perspective(2000px) rotateY(${shiftProgress * 15}deg) scale(${scale}) translateX(${translateX}px)`,
                zIndex: 50
              }}>
              
              <div className="relative w-full rounded-[2.5rem] bg-gradient-to-br from-slate-100 to-slate-300 p-[6px] shadow-2xl border border-white/50 overflow-visible">
                <div className="relative rounded-[2.2rem] bg-black p-2 overflow-hidden aspect-video">
                  
                  {/* 🌊 초음파 파동 🌊 */}
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-0">
                    {[1, 2, 3].map(n => (
                      <div key={n} className="absolute rounded-full border-[6px] border-blue-500/20 shadow-[0_0_50px_rgba(59,130,246,0.3)]"
                        style={{ 
                          width: `${250 + n * 150}px`, height: `${250 + n * 150}px`, 
                          animation: `echoRipple 4s ease-out ${(n * 0.8)}s infinite`,
                          opacity: (scrollProgress > 0.2 && scrollProgress < 0.95) ? 1 : 0
                        }} />
                    ))}
                  </div>

                  {/* 와이프 베이스 */}
                  <img src={baseImage} alt="Base" className="absolute inset-0 w-full h-full object-cover" 
                    style={{ filter: `grayscale(1) brightness(0.6) contrast(1.1)` }} />
                  
                  <div className="absolute inset-0 overflow-hidden" 
                    style={{ clipPath: `inset(0 ${100 - wipePos}% 0 0)`, transition: 'none' }}>
                    <img src={baseImage} alt="After" className="absolute inset-0 w-full h-full object-cover" />
                  </div>

                  {/* 와이프 라인 */}
                  <div className="absolute top-0 bottom-0 w-2 bg-white z-20 shadow-[0_0_40px_white] transition-opacity"
                    style={{ left: `${wipePos}%`, opacity: scrollProgress > 0.85 ? 0 : 1 }}>
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-2xl border-[6px] border-blue-500">
                      <div className="w-3 h-3 bg-blue-500 rounded-full animate-ping" />
                    </div>
                  </div>
                  
                  {/* 📡 한국어 햅틱 상태 📡 */}
                  {scrollProgress > 0.1 && (
                    <div className="absolute top-5 right-5 z-40 bg-black/80 backdrop-blur-md px-5 py-3 rounded-2xl border border-white/20 flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full shrink-0 ${scrollProgress > 0.5 ? 'bg-[#10B981] animate-ping' : 'bg-[#F59E0B] animate-pulse'}`} />
                      <span className="text-white text-sm font-black tracking-wider">
                        {scrollProgress > 0.5 ? "햅틱 IoT 연동 완료" : "햅틱 IoT 탐색 중"}
                      </span>
                    </div>
                  )}

                  {/* 🎯 최종 UI 🎯 */}
                  <div className="absolute inset-0 z-30 p-6 flex flex-col justify-end gap-3 transition-opacity duration-1000"
                    style={{ opacity: finalContentOpacity }}>
                    <div className="flex items-center gap-3 bg-white/95 backdrop-blur-md px-5 py-2.5 rounded-2xl border-l-[6px] border-blue-600 self-start shadow-xl">
                      <span className="text-blue-600 text-base font-black italic">🎷 [리드미컬한 연주]</span>
                      <div className="flex gap-1 items-end h-5">
                        {[1, 2, 3].map(n => <div key={n} className="w-1 bg-blue-400 rounded-full animate-vibrateBar" style={{ animationDelay: `${n * 0.1}s` }} />)}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 bg-white/95 backdrop-blur-md px-5 py-2.5 rounded-2xl border-l-[6px] border-indigo-600 self-start shadow-xl translate-x-8">
                      <span className="text-slate-900 text-base font-black">"오늘 무대 정말 최고였어요!" 😊</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 2. 우측 서비스 소개 (스크롤 끝) */}
            <div className="absolute top-0 bottom-0 flex flex-col items-start justify-center text-left space-y-10 transition-all duration-1000 px-8"
              style={{
                opacity: finalContentOpacity,
                transform: `translateX(${(1 - shiftProgress) * 60}px)`,
                pointerEvents: scrollProgress > 0.9 ? 'auto' : 'none',
                right: '18%',
                width: '380px',
              }}>
              <div className="space-y-6">
                <h2 className="text-7xl sm:text-8xl font-[1000] text-slate-900 tracking-tighter leading-none">
                  Sound<span className="text-blue-600 italic">View</span>
                </h2>
                <div className="space-y-3">
                  <p className="text-slate-500 text-2xl sm:text-3xl font-black">장벽 없는 새로운 영상 경험</p>
                  <p className="text-slate-500 text-lg font-bold leading-relaxed">
                    <span className="text-blue-600 font-black text-xl">AI 자막</span>과{" "}
                    <span className="text-indigo-600 font-black text-xl" style={{ display: 'inline-block', animation: 'hapticShake 1.8s linear infinite' }}>햅틱 기술</span>로 완성되는<br />혁신적인 감각의 확장을 만나보세요.
                  </p>
                </div>
              </div>
              <button onClick={() => kakaoLogin()}
                className="group relative flex h-14 items-center gap-4 rounded-full bg-[#F7E548] px-8 text-base font-black text-slate-900 shadow-lg transition-all hover:scale-105 active:scale-95 overflow-hidden self-start">
                <div className="absolute top-0 -left-full w-full h-full bg-gradient-to-r from-transparent via-white/40 to-transparent skew-x-[-25deg] group-hover:left-[200%] transition-all duration-1000" />
                <img src={kakaoLoginIcon} alt="" className="w-5 h-5" />
                카카오로 시작하기
              </button>
            </div>

          </div>

          {/* 💥 자막 폭발 레이어 💥 */}
          <div className="fixed inset-0 pointer-events-none z-[9999]" style={{ opacity: burstOpacity }}>
            {burstCaptions.map((el, i) => {
              const isActive = scrollProgress > el.delay;
              const travelProgress = Math.min(1, Math.max(0, (scrollProgress - el.delay) / (0.9 - el.delay)));
              const eased = Math.pow(travelProgress, 0.85);
              return isActive ? (
                <div key={i} className="absolute top-1/2 left-1/2"
                  style={{
                    transform: `translate(calc(-50% + ${el.x * eased}vw), calc(-50% + ${el.y * eased}vh)) scale(${0.4 + eased * 1.4}) rotate(${el.rot * eased}deg)`,
                    opacity: 1 - Math.pow(eased, 15),
                  }}>
                  <div className="flex items-center gap-3 bg-white/95 backdrop-blur-2xl px-6 py-3 rounded-2xl border-2 shadow-2xl" style={{ borderColor: el.color }}>
                    <span className="text-3xl">{el.emoji}</span>
                    <span className="text-lg font-[1000] text-slate-800 whitespace-nowrap">{el.text}</span>
                  </div>
                </div>
              ) : null;
            })}
          </div>

        </div>
      </section>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900;1000&display=swap');
        .lp-ultimate-refined-compact { font-family: 'Inter', sans-serif; }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(60px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes echoRipple {
          0% { transform: scale(0.8) translate(-50%, -50%); opacity: 0; }
          30% { opacity: 0.5; }
          100% { transform: scale(2.2) translate(-50%, -50%); opacity: 0; }
        }
        @keyframes vibrateBar { 0%, 100% { height: 8px; } 50% { height: 20px; } }
        @keyframes heroRipple {
          0%   { transform: scale(1);   opacity: 0.7; }
          60%  { opacity: 0.3; }
          100% { transform: scale(4.5); opacity: 0; }
        }
        @keyframes hapticShake {
          0%    { transform: translateX(0px); }
          4%    { transform: translateX(-3px); }
          8%    { transform: translateX(3px); }
          12%   { transform: translateX(-3px); }
          16%   { transform: translateX(3px); }
          20%   { transform: translateX(-2px); }
          24%   { transform: translateX(2px); }
          28%   { transform: translateX(0px); }
          100%  { transform: translateX(0px); }
        }
        @keyframes scrollDot { 0%, 100% { transform: translateY(0); opacity: 1; } 50% { transform: translateY(14px); opacity: 0.3; } }
        .lp-ultimate-refined-compact::-webkit-scrollbar { width: 0; }
      `}</style>
    </div>
  );
}
