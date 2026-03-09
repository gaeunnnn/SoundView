// 노트북 비주얼과 before/after 화면 상태를 보여주는 로그인 전용 컴포넌트 파일
// 필요 이미지:
// 1) src/assets/images/LaptopMockup.png
// 2) src/assets/images/HeroVideoPreview.png
import LaptopMockup from "../../assets/images/LaptopMockup.png";
import HeroVideoPreview from "../../assets/images/HeroVideoPreview.png";

type LaptopShowcaseProps = {
  isAfterActive: boolean;
  rotationDeg: number;
};

export default function LaptopShowcase({
  isAfterActive,
  rotationDeg,
}: LaptopShowcaseProps) {
  return (
    <div className="relative w-[640px]">
      <div
        className="relative mx-auto w-[520px] transition-transform duration-300"
        style={{
          transform: `perspective(1400px) rotateY(${rotationDeg}deg)`,
          transformStyle: "preserve-3d",
        }}
      >
        <div className="absolute left-[58px] top-[28px] z-10 h-[240px] w-[404px] overflow-hidden rounded-[10px] bg-black">
          <img
            src={HeroVideoPreview}
            alt="영상 미리보기"
            className="h-full w-full object-cover"
          />

          {isAfterActive && (
            <>
              <div className="absolute right-4 top-4 rounded-xl bg-[rgba(35,40,52,0.72)] px-3 py-2 text-[12px] text-white">
                🔥 🎆 🎵
              </div>

              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 rounded-lg bg-[rgba(20,22,30,0.78)] px-4 py-2 text-[12px] font-medium text-white">
                [불꽃 터지는 소리]
              </div>
            </>
          )}
        </div>

        <img
          src={LaptopMockup}
          alt="노트북 목업"
          className="relative z-20 w-full object-contain"
        />
      </div>
    </div>
  );
}