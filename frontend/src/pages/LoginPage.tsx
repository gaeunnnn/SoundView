import { useCallback, useState } from "react";
import { kakaoLogin } from "../api/auth";
import LogoIcon from "../assets/images/LogoIcon.png";
import loginBeforeImage from "../assets/images/login(before).png";
import loginAfterImage from "../assets/images/login.png";
import kakaoLoginIcon from "../assets/icons/login_kakao.png";
import { ImageComparison } from "../components/ui/image-comparison-slider";

export default function LoginPage() {
  const [pos, setPos] = useState(0);
  const handlePosChange = useCallback((p: number) => setPos(p), []);

  const showRipple = pos > 60;
  const isAfterFull = pos > 95;
  const isTransitioning = pos > 5 && pos < 95;

  return (
    <div
      className="relative flex h-screen w-full flex-col items-center justify-center overflow-hidden"
      style={{ background: "radial-gradient(ellipse 100% 60% at 50% 0%, #E0E7FF 0%, transparent 55%), #F8FAFF" }}
    >
      {/* 배경 블롭 */}
      <div className="pointer-events-none absolute -top-40 -left-40 w-[560px] h-[560px] rounded-full blur-3xl"
        style={{ background: "radial-gradient(circle, rgba(165,180,252,0.4) 0%, transparent 70%)", animation: "blob 14s ease-in-out infinite" }} />
      <div className="pointer-events-none absolute -bottom-32 -right-32 w-[460px] h-[460px] rounded-full blur-3xl"
        style={{ background: "radial-gradient(circle, rgba(196,181,253,0.3) 0%, transparent 70%)", animation: "blob 18s ease-in-out 5s infinite reverse" }} />

      {/* 로고 */}
      <div className="absolute top-5 left-6 flex items-center gap-3 z-10" style={{ animation: "fadeUp 0.5s ease both" }}>
        <img src={LogoIcon} alt="" className="w-11 h-11" />
        <span className="text-lg font-black tracking-wide text-slate-900">SoundView</span>
      </div>

      {/* 우상단 — 상태 pill */}
      <div className="absolute top-6 right-6 z-10 flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-semibold transition-all duration-700"
        style={{
          background: isAfterFull ? "rgba(30,158,244,0.1)" : "rgba(148,163,184,0.1)",
          border: `1px solid ${isAfterFull ? "rgba(30,158,244,0.3)" : "rgba(148,163,184,0.2)"}`,
          color: isAfterFull ? "#1E9EF4" : "#94A3B8",
        }}>
        <span className="w-1.5 h-1.5 rounded-full inline-block"
          style={{ background: isAfterFull ? "#1E9EF4" : "#94A3B8", animation: isAfterFull ? "pulse 1.5s ease-in-out infinite" : "none" }} />
        {isAfterFull ? "SoundView 적용됨" : isTransitioning ? "변환 중..." : "적용 전"}
      </div>

      {/* 콘텐츠 */}
      <div className="relative z-10 flex w-full max-w-4xl flex-col items-center gap-4 px-6">

        {/* 헤드라인 */}
        <div className="text-center" style={{ animation: "fadeUp 0.6s ease 0.1s both" }}>
          <p className="mb-2 text-[11px] font-semibold tracking-widest uppercase text-blue-400">
            청각장애인을 위한 영상 경험
          </p>
          <h1 style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: "clamp(1.9rem, 4.5vw, 2.8rem)",
            fontWeight: 700,
            letterSpacing: "-0.02em",
            lineHeight: 1.2,
            color: "#334155",
          }}>
            소리를{" "}
            <span style={{ color: "#1E9EF4", fontWeight: 800 }}>눈</span>
            과{" "}
            <span style={{ color: "#1E9EF4", fontWeight: 800 }}>손</span>
            으로 느끼다
          </h1>
        </div>

        {/* 이미지 */}
        <div className="relative w-full" style={{ animation: "fadeUp 0.6s ease 0.2s both" }}>

          {/* 파동 */}
          {showRipple && [0, 1, 2, 3].map((n) => (
            <div key={n} className="pointer-events-none absolute rounded-full"
              style={{
                top: "50%", left: "50%",
                transform: "translate(-50%, -50%)",
                width: 10, height: 10,
                border: "3px solid #1E9EF4",
                boxShadow: "0 0 12px rgba(30,158,244,0.6)",
                animation: `rippleGrow 2.8s ease-out ${n * 0.6}s infinite`,
              }} />
          ))}

          <ImageComparison
            beforeImage={loginBeforeImage}
            afterImage={loginAfterImage}
            altBefore="SoundView 적용 전"
            altAfter="SoundView 적용 후"
            onPosChange={handlePosChange}
          />

          {/* 하단 타이머 바 */}
          <div className="absolute -bottom-2 inset-x-0 h-0.5 rounded-full bg-slate-200 overflow-hidden">
            <div className="h-full rounded-full transition-none"
              style={{
                width: `${pos}%`,
                background: "linear-gradient(90deg, #93C5FD, #1E9EF4)",
              }} />
          </div>
        </div>

        {/* 카카오 버튼 */}
        <div className="flex flex-col items-center gap-2" style={{ animation: "fadeUp 0.6s ease 0.3s both" }}>
          <button
            type="button"
            onClick={() => kakaoLogin()}
            className="inline-flex h-12 items-center gap-2.5 rounded-full px-8 text-sm font-bold text-[#1A0F00] transition-all hover:scale-105 hover:brightness-95 active:scale-100"
            style={{ background: "#F7E548", boxShadow: "0 6px 24px rgba(247,229,72,0.45)" }}
          >
            {/* live 점 */}
            <span className="w-2 h-2 rounded-full bg-yellow-600/50 animate-pulse" />
            <img src={kakaoLoginIcon} alt="" className="w-5 h-5" />
            카카오로 시작하기
          </button>
        </div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@700;800&display=swap');
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(18px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes blob {
          0%, 100% { transform: translate(0,0) scale(1); }
          33%  { transform: translate(30px,-20px) scale(1.05); }
          66%  { transform: translate(-20px,15px) scale(0.97); }
        }
        @keyframes rippleGrow {
          0%   { width: 10px;  height: 10px;  opacity: 1; }
          40%  { opacity: 0.7; }
          100% { width: 900px; height: 900px; opacity: 0; }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.3; }
        }
      `}</style>
    </div>
  );
}
