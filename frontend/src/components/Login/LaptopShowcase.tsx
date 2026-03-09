// 노트북 화면과 before/after 상태를 보여주는 컴포넌트 파일
// 필요 이미지:
// 1) src/assets/images/LaptopMockup.png
// 2) src/assets/images/LaptopScreenBefore.png
// 3) src/assets/images/LaptopScreenAfter.png
import LaptopMockup from "../../assets/images/LaptopMockup.png";
import LaptopScreenBefore from "../../assets/images/LaptopScreenBefore.png";
import LaptopScreenAfter from "../../assets/images/LaptopScreenAfter.png";

type LaptopShowcaseProps = {
  isAfterActive: boolean;
  rotationDeg: number;
};

export default function LaptopShowcase({
  isAfterActive,
  rotationDeg,
}: LaptopShowcaseProps) {
  return (
    <div className="relative mx-auto w-full max-w-[640px]">
      <div
        className="relative mx-auto w-[min(90vw,520px)] transition-transform duration-200"
        style={{
          transform: `perspective(1400px) rotateY(${-rotationDeg}deg)`,
          transformStyle: "preserve-3d",
        }}
      >
        <div className="absolute left-[11.15%] top-[8.75%] z-10 h-[75%] w-[77.7%] overflow-hidden rounded-[10px] bg-[#111827]">
          <img
            src={isAfterActive ? LaptopScreenAfter : LaptopScreenBefore}
            alt="노트북 화면"
            className="h-full w-full object-cover"
          />

          {isAfterActive && (
            <>
              <div className="absolute right-3 top-3 rounded-xl bg-[rgba(35,40,52,0.72)] px-3 py-2 text-[11px] text-white sm:right-4 sm:top-4 sm:text-[12px]">
                소리 감지 활성화
              </div>

              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-lg bg-[rgba(20,22,30,0.78)] px-4 py-2 text-[11px] font-medium text-white sm:bottom-6 sm:text-[12px]">
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