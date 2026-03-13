// 노트북 3D 모델과 before/after 화면 상태를 보여주는 컴포넌트 파일
//
// 화면 이미지가 준비되면 아래 주석을 해제하고 경로만 교체하면 됩니다:
//   screenTexturePath={isAfterActive ? "/images/LaptopScreenAfter.jpg" : "/images/LaptopScreenBefore.jpg"}
//
// 이미지 요건:
//   - 파일 위치: public/images/LaptopScreenAfter.jpg, LaptopScreenBefore.jpg
//   - 권장 해상도: 1280×800 (16:10 노트북 화면 비율)
//   - 색상 공간: sRGB (LaptopViewer 내부에서 자동 처리)
import LaptopViewer from "./LaptopViewer";

type LaptopShowcaseProps = {
  isAfterActive: boolean;
  rotationDeg: number;
};

export default function LaptopShowcase({
  isAfterActive,
  rotationDeg,
}: LaptopShowcaseProps) {
  const screenTexturePath = isAfterActive
    ? "/images/LaptopScreenAfter.png"
    : "/images/LaptopScreenBefore.png";

  return (
    <div className="relative mx-auto w-full max-w-160">
      <LaptopViewer
        rotationDeg={rotationDeg}
        screenTexturePath={screenTexturePath}
      />
    </div>
  );
}
