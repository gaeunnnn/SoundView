// 로그인 페이지 오른쪽 설명 박스와 카카오 시작 버튼을 보여주는 컴포넌트 파일
import { kakaoLogin } from "../../api/auth";

export default function LoginInfoCard() {
  const handleKakaoLogin = () => {
    kakaoLogin();
  };

  return (
    <div className="rounded-[28px] border border-[#E0E8FF] bg-white px-7 py-8 shadow-[0_16px_40px_rgba(79,110,247,0.1)] sm:px-9 sm:py-10">
      {/* 통계 수치 */}
      <div className="mb-7 flex items-center justify-between text-center">
        <div className="flex-1">
          <p className="text-[22px] font-extrabold text-[#4F6EF7] sm:text-[24px]">12+</p>
          <p className="mt-1 text-[11px] text-[#A0AABF] sm:text-[12px]">환경음 유형</p>
        </div>
        <div className="h-8 w-px bg-[#EDF1F7]" />
        <div className="flex-1">
          <p className="text-[22px] font-extrabold text-[#4F6EF7] sm:text-[24px]">98%</p>
          <p className="mt-1 text-[11px] text-[#A0AABF] sm:text-[12px]">인식 정확도</p>
        </div>
        <div className="h-8 w-px bg-[#EDF1F7]" />
        <div className="flex-1">
          <p className="text-[22px] font-extrabold text-[#4F6EF7] sm:text-[24px]">실시간</p>
          <p className="mt-1 text-[11px] text-[#A0AABF] sm:text-[12px]">자막 생성</p>
        </div>
      </div>

      <div className="h-px w-full bg-[#EDF1F7]" />

      <button
        type="button"
        onClick={handleKakaoLogin}
        className="mt-7 flex h-[60px] w-full items-center justify-center gap-2 rounded-[18px] bg-[#F7E548] text-[16px] font-bold text-[#2A1D00] transition hover:brightness-95 sm:mt-7 sm:h-[64px] sm:rounded-[20px] sm:text-[17px]"
      >
        <span className="text-[20px]">💬</span>
        카카오톡으로 시작하기
      </button>

      <p className="mt-5 text-center text-[11px] leading-[1.7] text-[#C2C8D4] sm:mt-6 sm:text-[12px]">
        로그인 시 서비스 이용약관 및 개인정보 처리방침에 동의합니다.
      </p>
    </div>
  );
}