// 영상 제목·업로더·날짜를 표시하는 메타 바 컴포넌트 파일
type VideoMetaProps = {
  title: string;
  uploaderLabel: string;
  date: string;
};

export default function VideoMeta({ title, uploaderLabel, date }: VideoMetaProps) {
  return (
    <div className="flex shrink-0 items-center gap-3 border-b border-[#1E293B] bg-[#1E293B]/60 px-5 py-2.5">
      <span className="text-sm font-bold text-white">{title}</span>
      <span className="text-[#475569]">·</span>
      <span className="text-sm text-[#64748B]">{uploaderLabel} · {date}</span>
    </div>
  );
}
