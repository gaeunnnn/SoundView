// 공통으로 사용할 서비스 로고 영역 컴포넌트 파일
import LogoIcon from "../../assets/images/LogoIcon.png";

export default function Logo() {
  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-4">
        <img
          src={LogoIcon}
          alt="SoundSee 로고"
          className="h-10 w-auto object-contain sm:h-12"
        />
      </div>

      <p className="mt-3 pl-20 text-[14px] font-medium text-[#98A2B3] sm:text-[16px]">
        소리를 눈으로 경험하세요
      </p>
    </div>
  );
}