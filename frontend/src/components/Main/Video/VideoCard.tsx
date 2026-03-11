// 내 앨범 영상 카드 컴포넌트
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Ellipsis } from "lucide-react";
import type { VideoItem } from "../../../types/video";
import VideoThumbnail from "../Card/VideoThumbnail";
import VideoTitleEditor from "../Card/VideoTitleEditor";
import VideoCardMenu from "./VideoCardMenu";

type VideoCardProps = {
  video: VideoItem;
  isMenuOpen: boolean;
  onToggleMenu: (videoId: number) => void;
  onEdit: (videoId: number) => void;
  onShare: (videoId: number) => void;
  onDelete: (videoId: number) => void;
  onRenameTitle: (videoId: number, newTitle: string) => void;
};

export default function VideoCard({
  video,
  isMenuOpen,
  onToggleMenu,
  onEdit,
  onShare,
  onDelete,
  onRenameTitle,
}: VideoCardProps) {
  const navigate = useNavigate();
  const menuRef = useRef<HTMLDivElement>(null);

  // 메뉴 외부 클릭 시 닫기
  useEffect(() => {
    if (!isMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onToggleMenu(video.id);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isMenuOpen, video.id, onToggleMenu]);

  return (
    <article className="rounded-[22px] border border-[#E5EAF1] bg-white">
      <VideoThumbnail
        src={video.thumbnail}
        alt={video.title}
        duration={video.duration}
        onClick={() => navigate("/viewer", { state: { video } })}
      />

      <div className="px-3 pb-3 pt-3">
        {/* 제목 행: 제목 + 연필 + 점3개 메뉴 */}
        <div className="flex items-center gap-1.5">
          <div className="flex min-w-0 flex-1 items-center gap-1.5">
            <VideoTitleEditor
              title={video.title}
              onCommit={(newTitle) => onRenameTitle(video.id, newTitle)}
            />
          </div>
          <div ref={menuRef} className="relative shrink-0">
            <button
              type="button"
              onClick={() => onToggleMenu(video.id)}
              className="flex h-7 w-7 items-center justify-center rounded-full text-[#94A3B8] transition-colors hover:bg-[#F3F4F6] hover:text-[#64748B]"
              aria-label={`${video.title} 더보기`}
            >
              <Ellipsis size={15} strokeWidth={2} />
            </button>
            <VideoCardMenu
              open={isMenuOpen}
              onEdit={() => onEdit(video.id)}
              onShare={() => onShare(video.id)}
              onDelete={() => onDelete(video.id)}
            />
          </div>
        </div>

        {/* 날짜 행 */}
        <p className="mt-1.5 text-xs font-medium text-[#94A3B8]">{video.date}</p>
      </div>
    </article>
  );
}
