// 로그인 페이지 왼쪽 메인 비주얼 영역을 묶는 컴포넌트 파일
import BeforeAfterToggle from "./BeforeAfterToggle";
import LaptopShowcase from "./LaptopShowcase";
import ScrollIndicator from "./ScrollIndicator";

type LoginHeroProps = {
  rotationDeg: number;
  isAfterActive: boolean;
};

export default function LoginHero({
  rotationDeg,
  isAfterActive,
}: LoginHeroProps) {
  return (
    <section className="flex w-full flex-col items-center">
      <BeforeAfterToggle isAfterActive={isAfterActive} />

      <div className="mt-6 w-full sm:mt-8">
        <LaptopShowcase
          rotationDeg={rotationDeg}
          isAfterActive={isAfterActive}
        />
      </div>

      <div className="mt-6 sm:mt-8 lg:mt-10">
        <ScrollIndicator />
      </div>
    </section>
  );
}