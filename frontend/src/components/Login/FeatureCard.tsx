// 로그인 페이지 기능 소개 카드 하나를 재사용하기 위한 컴포넌트 파일
type FeatureCardProps = {
  icon: string;
  title: string;
  description: string;
};

export default function FeatureCard({
  icon,
  title,
  description,
}: FeatureCardProps) {
  return (
    <div className="flex h-[96px] w-full flex-col items-center justify-center rounded-[20px] border border-[#E9EDF5] bg-white px-2 text-center shadow-[0_6px_14px_rgba(15,23,42,0.06)] sm:h-[104px]">
      <div className="text-[22px] sm:text-[24px]">{icon}</div>
      <h3 className="mt-2 text-[14px] font-bold text-[#2B3447] sm:text-[15px]">
        {title}
      </h3>
      <p className="mt-1 text-[11px] font-medium text-[#A1A8B8] sm:text-[12px]">
        {description}
      </p>
    </div>
  );
}