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
      className="relative aspect-video cursor-pointer overflow-hidden rounded-t-[22px] bg-[#E5E7EB]"
      onClick={onClick}
    >
      <img src={src} alt={alt} className="h-full w-full object-cover" />
      <div className="absolute bottom-3 right-3 flex items-center gap-1 rounded-full bg-black/60 px-2 py-1 text-[11px] font-semibold text-white">
        <Clock3 size={12} strokeWidth={2} />
        <span>{duration}</span>
      </div>
    </div>
  );
}
