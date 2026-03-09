// 여러 페이지에서 공통으로 쓸 수 있는 서비스 로고 컴포넌트 파일
// 필요 이미지: src/assets/images/LogoIcon.png
import LogoIcon from "../../assets/images/LogoIcon.png";

export default function Logo() {
  return (
    <div className="flex items-center gap-4">
      <img
        src={LogoIcon}
        alt="SoundSee 로고"
        className="h-16 w-16 rounded-2xl object-cover"
      />

      <div>

        <p className="mt-2 text-[14px] font-medium text-[#98A2B3]">
          소리를 눈으로 경험하세요
        </p>
      </div>
    </div>
  );
}