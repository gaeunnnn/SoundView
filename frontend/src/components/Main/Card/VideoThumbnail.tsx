// 영상 카드 공통 썸네일 컴포넌트 (내 앨범 / 공유앨범 공용)
import { Clock3 } from "lucide-react";

type VideoThumbnailProps = {
  src: string;
  alt: string;
  duration: string;
  onClick: () => void;
};

export default function VideoThumbnail({ src, alt, duration, onClick }: VideoThumbnailProps) {
  return (
    <div
      className="relative aspect-video cursor-pointer overflow-hidden rounded-t-[22px] bg-[#0F172A] group"
      onClick={onClick}
    >
      <img
        src={src}
        alt={alt}
        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105 group-hover:opacity-80"
      />
      {/* 하단 그라데이션 오버레이 */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
      {/* 재생 버튼 — hover 시 중앙에 표시 */}
      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm border border-white/40">
          <svg viewBox="0 0 24 24" fill="white" className="h-5 w-5 ml-0.5">
            <path d="M8 5v14l11-7z" />
          </svg>
        </div>
      </div>
      {/* 재생 시간 */}
      <div className="absolute bottom-2.5 right-2.5 flex items-center gap-1 rounded-md bg-black/70 px-1.5 py-0.5 text-[11px] font-semibold text-white backdrop-blur-sm">
        <Clock3 size={11} strokeWidth={2} />
        <span>{duration}</span>
      </div>
    </div>
  );
}
