import Logo from "../components/Common/Logo";
import LoginHero from "../components/Login/LoginHero";
import FeatureGrid from "../components/Login/FeatureGrid";
import LoginInfoCard from "../components/Login/LoginInfoCard";
import ScrollProgressBar from "../components/Login/ScrollProgressBar";

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-[#f5f7fb] relative overflow-hidden">

      {/* 상단 로고 */}
      <div className="absolute top-8 left-10">
        <Logo />
      </div>

      <div className="flex w-full h-screen">

        {/* 왼쪽 히어로 영역 */}
        <div className="w-1/2 flex items-center justify-center">
          <LoginHero />
        </div>

        {/* 오른쪽 설명 영역 */}
        <div className="w-1/2 flex flex-col items-center justify-center gap-10">
          <FeatureGrid />
          <LoginInfoCard />
        </div>

      </div>

      <ScrollProgressBar />

    </div>
  );
}