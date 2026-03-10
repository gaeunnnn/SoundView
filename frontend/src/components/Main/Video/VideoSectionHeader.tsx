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
      <h1 className="text-[40px] font-extrabold tracking-[-0.03em] text-[#111827]">
        {title}
      </h1>
      <p className="text-[17px] font-medium text-[#94A3B8]">{count}개의 영상</p>
    </section>
  );
}