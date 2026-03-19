// 로그인 페이지 전체 레이아웃을 조립하는 페이지 파일
import { useEffect, useRef, useState } from "react";
import { kakaoLogin } from "../api/auth";
import loginBeforeImage from "../assets/images/login(before).png";
import loginAfterImage from "../assets/images/login.png";
import LogoIcon from "../assets/images/LogoIcon.png";

export default function LoginPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  // 0 = before 완전히 보임, 1 = after 완전히 보임
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const scrollY = container.scrollTop;
      // 0~400px 스크롤 구간에서 0→1로 전환
      const p = Math.min(scrollY / 400, 1);
      setProgress(p);
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => container.removeEventListener("scroll", handleScroll);
  }, []);

  // 스크롤 진행에 따라 before는 오른쪽으로 회전하며 사라지고
  // after는 왼쪽에서 회전하며 등장
  const beforeRotateY = progress * 90; // 0deg → 90deg (옆으로 사라짐)
  const afterRotateY = 90 - progress * 90; // 90deg → 0deg (정면으로 등장)

  return (
    <div
      ref={containerRef}
      className="h-screen w-full overflow-y-scroll bg-white"
      style={{ scrollSnapType: "y mandatory" }}
    >
      {/* ── 첫 번째 스냅 섹션: 고정 UI ── */}
      <div
        className="sticky top-0 flex h-screen w-full flex-col"
        style={{ scrollSnapAlign: "start" }}
      >
        {/* 상단 로고 */}
        <header className="flex items-center px-6 py-3 sm:px-10">
          <img src={LogoIcon} alt="SoundSee 로고" className="h-12 w-auto" />
        </header>

        {/* 메인 영역 */}
        <main className="flex flex-1 flex-col items-center justify-center px-6 pb-4">
          {/* 이미지 전환 영역 — 두 이미지를 absolute로 겹쳐 크기 고정 */}
          <div className="relative w-full max-w-[820px]">
            {/* 크기 기준 역할 (보이지 않음) */}
            <img
              src={loginBeforeImage}
              alt=""
              className="w-full rounded-[24px] invisible"
              aria-hidden="true"
              draggable={false}
            />

            {/* Before 이미지 */}
            <div
              className="absolute inset-0 select-none"
              style={{
                transform: `perspective(1200px) rotateY(${-8 + beforeRotateY}deg) rotateX(3deg)`,
                filter: "drop-shadow(0 30px 50px rgba(0,0,0,0.18)) drop-shadow(0 8px 20px rgba(79,110,247,0.2))",
                opacity: progress < 0.5 ? 1 - progress * 2 : 0,
                pointerEvents: progress >= 0.5 ? "none" : "auto",
              }}
            >
              <img
                src={loginBeforeImage}
                alt="SoundSee Before"
                className="w-full rounded-[24px]"
                draggable={false}
              />
            </div>

            {/* After 이미지 */}
            <div
              className="absolute inset-0 select-none"
              style={{
                transform: `perspective(1200px) rotateY(${-8 + afterRotateY}deg) rotateX(3deg)`,
                filter: "drop-shadow(0 30px 50px rgba(0,0,0,0.18)) drop-shadow(0 8px 20px rgba(79,110,247,0.2))",
                opacity: progress > 0.5 ? (progress - 0.5) * 2 : 0,
                pointerEvents: progress < 0.5 ? "none" : "auto",
              }}
            >
              <img
                src={loginAfterImage}
                alt="SoundSee After"
                className="w-full rounded-[24px]"
                draggable={false}
              />
            </div>
          </div>

          {/* 제목 */}
          <h1 className="mt-6 text-center text-[24px] font-extrabold leading-[1.3] text-[#1A2340] sm:text-[30px]">
            소리를 눈과 촉각으로 경험하는 서비스
          </h1>

          {/* 기능 태그 + 카카오 버튼 */}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
            {[
              { emoji: "🔊", label: "환경음 인식" },
              { emoji: "💬", label: "대화 자막" },
              { emoji: "📳", label: "진동 피드백" },
              { emoji: "😊", label: "이모티콘" },
            ].map(({ emoji, label }) => (
              <span
                key={label}
                className="flex items-center gap-1.5 text-[14px] text-[#6B7A9A]"
              >
                <span className="text-[15px]">{emoji}</span>
                {label}
              </span>
            ))}

            <button
              type="button"
              onClick={() => kakaoLogin()}
              className="flex h-[48px] items-center gap-2 rounded-full bg-[#F7E548] px-6 text-[15px] font-bold text-[#2A1D00] transition hover:brightness-95"
            >
              <span className="text-[18px]">💬</span>
              카카오로 시작하기
            </button>
          </div>
        </main>
      </div>

      {/* ── 스크롤 여백: 이 구간 스크롤하면서 이미지 전환 ── */}
      <div className="h-[400px]" aria-hidden="true" />
    </div>
  );
}
