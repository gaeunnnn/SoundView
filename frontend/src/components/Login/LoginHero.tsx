// 로그인 페이지 왼쪽 메인 비주얼 영역을 묶는 컴포넌트 파일
import BeforeAfterToggle from "./BeforeAfterToggle";
import LaptopShowcase from "./LaptopShowcase";
import ScrollIndicator from "./ScrollIndicator";

export default function LoginHero() {
  return (
    <section className="flex flex-col items-center">
      <BeforeAfterToggle isAfterActive={false} />
      <div className="mt-8">
        <LaptopShowcase isAfterActive={false} rotationDeg={0} />
      </div>
      <div className="mt-10">
        <ScrollIndicator />
      </div>
    </section>
  );
}