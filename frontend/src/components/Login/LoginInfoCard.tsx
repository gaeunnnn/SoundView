// 로그인 페이지 오른쪽 설명 박스와 카카오 시작 버튼을 보여주는 컴포넌트 파일
export default function LoginInfoCard() {
  const handleKakaoLogin = () => {
    alert("카카오 로그인 화면으로 이동 예정입니다.");
  };

  return (
    <div className="rounded-[24px] border border-[#E8ECF4] bg-white px-6 py-8 shadow-[0_12px_30px_rgba(15,23,42,0.05)] sm:rounded-[28px] sm:px-8 sm:py-10">
      <h2 className="text-[24px] font-bold leading-[1.35] text-[#1F2937] sm:text-[28px]">
        소리를 눈으로
        <br />
        <span className="text-[#4F6EF7]">경험하세요</span>
      </h2>

      <p className="mt-4 text-[14px] leading-[1.8] text-[#98A2B3] sm:mt-5 sm:text-[16px]">
        AI가 영상 속 환경음과 대화를 인식하여
        <br />
        자막, 이모티콘, 진동으로 전달합니다.
      </p>

      <div className="mt-8 flex items-start justify-between text-center sm:mt-10">
        <div className="flex-1">
          <p className="text-[17px] font-bold text-[#27324A] sm:text-[18px]">
            12+
          </p>
          <p className="mt-2 text-[11px] text-[#B4BCCB] sm:text-[12px]">
            환경음 유형
          </p>
        </div>

        <div className="flex-1">
          <p className="text-[17px] font-bold text-[#27324A] sm:text-[18px]">
            98%
          </p>
          <p className="mt-2 text-[11px] text-[#B4BCCB] sm:text-[12px]">
            인식 정확도
          </p>
        </div>

        <div className="flex-1">
          <p className="text-[17px] font-bold text-[#27324A] sm:text-[18px]">
            실시간
          </p>
          <p className="mt-2 text-[11px] text-[#B4BCCB] sm:text-[12px]">
            자막 생성
          </p>
        </div>
      </div>

      <div className="mt-7 h-px w-full bg-[#EDF1F7] sm:mt-8" />

      <button
        type="button"
        onClick={handleKakaoLogin}
        className="mt-7 flex h-[60px] w-full items-center justify-center rounded-[18px] bg-[#F7E548] text-[16px] font-bold text-[#2A1D00] transition hover:brightness-95 sm:mt-8 sm:h-[68px] sm:rounded-[20px] sm:text-[18px]"
      >
        카카오톡으로 시작하기
      </button>

      <p className="mt-6 text-center text-[11px] leading-[1.7] text-[#C2C8D4] sm:mt-7 sm:text-[12px]">
        로그인 시 서비스 이용약관 및 개인정보 처리방침에 동의합니다.
      </p>
    </div>
  );
}