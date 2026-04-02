// 영상 영역 상단의 제목과 영상 개수 정보를 렌더링하는 컴포넌트 파일
type VideoSectionHeaderProps = {
  title: string;
  count: number;
};

export default function VideoSectionHeader({
  title,
  count,
}: VideoSectionHeaderProps) {
  return (
    <section className="space-y-2">
      <h1 className="text-2xl font-bold text-[#0F172A]">{title}</h1>
      <span className="inline-flex items-center rounded-full bg-[#EEF4FF] px-2.5 py-0.5 text-xs font-semibold text-[#2563EB]">
        {count}개의 영상
      </span>
    </section>
  );
}