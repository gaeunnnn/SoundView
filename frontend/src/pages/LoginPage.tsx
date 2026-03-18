// 로그인 페이지 전체 레이아웃을 조립하는 페이지 파일
import Logo from "../components/Common/Logo";
import HelpButton from "../components/Common/HelpButton";
import FeatureGrid from "../components/Login/FeatureGrid";
import LoginHero from "../components/Login/LoginHero";
import LoginInfoCard from "../components/Login/LoginInfoCard";
import ScrollProgressBar from "../components/Login/ScrollProgressBar";
import useScrollProgress from "../hooks/useScrollProgress";

export default function LoginPage() {
  const { scrollProgress, rotationDeg, isAfterActive } = useScrollProgress();

  return (
    <div className="relative min-h-screen w-full bg-[#F7F8FC] overflow-x-hidden">
      <div className="absolute left-4 top-4 z-20 sm:left-6 sm:top-6 lg:left-12 lg:top-8">
        <Logo />
      </div>

      <div className="mx-auto flex min-h-screen w-full max-w-[1440px] flex-col justify-center gap-6 px-4 pb-16 pt-20 sm:pt-24 md:px-8 lg:flex-row lg:items-center lg:justify-between lg:gap-12 lg:px-12 lg:pb-16 lg:pt-24">
        {/* 노트북 쇼케이스 — md 이상에서만 표시 */}
        <div className="hidden md:flex min-h-0 flex-1 items-center justify-center">
          <LoginHero
            rotationDeg={rotationDeg}
            isAfterActive={isAfterActive}
          />
        </div>

        <div className="mx-auto flex w-full max-w-[430px] flex-col gap-4 lg:mx-0 lg:w-[430px] lg:gap-6">
          <FeatureGrid />
          <LoginInfoCard />
        </div>
      </div>

      <div className="fixed bottom-4 right-4 z-20 sm:bottom-5 sm:right-5 lg:bottom-6 lg:right-6">
        <HelpButton />
      </div>

      <ScrollProgressBar progress={scrollProgress} />
    </div>
  );
}