// 영상 카드 한 개를 렌더링하는 컴포넌트 파일
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Clock3, Ellipsis, Pencil } from "lucide-react";
import type { VideoItem } from "../../../types/video";
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
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(video.title);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // 인라인 편집 시 input 포커스
  useEffect(() => {
    if (isEditing) inputRef.current?.focus();
  }, [isEditing]);

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

  const handlePencilClick = () => {
    setEditTitle(video.title);
    setIsEditing(true);
  };

  const handleTitleCommit = () => {
    const trimmed = editTitle.trim();
    if (trimmed && trimmed !== video.title) {
      onRenameTitle(video.id, trimmed);
    } else {
      setEditTitle(video.title);
    }
    setIsEditing(false);
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") handleTitleCommit();
    if (e.key === "Escape") {
      setEditTitle(video.title);
      setIsEditing(false);
    }
  };

  return (
    <article className="relative rounded-[22px] border border-[#E5EAF1] bg-white">
      <div
        className="relative aspect-video cursor-pointer overflow-hidden bg-[#E5E7EB]"
        onClick={() => navigate("/viewer", { state: { video } })}
      >
        <img
          src={video.thumbnail}
          alt={video.title}
          className="h-full w-full object-cover"
        />

        <div className="absolute bottom-3 right-3 flex items-center gap-1 rounded-full bg-black/60 px-2 py-1 text-[11px] font-semibold text-white">
          <Clock3 size={12} strokeWidth={2} />
          <span>{video.duration}</span>
        </div>
      </div>

      <div className="flex items-start justify-between px-3 pb-3 pt-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            {isEditing ? (
              <input
                ref={inputRef}
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                onBlur={handleTitleCommit}
                onKeyDown={handleTitleKeyDown}
                className="w-full rounded-lg border border-[#2563EB] px-2 py-0.5 text-sm font-bold text-[#111827] outline-none ring-2 ring-[#2563EB]/20"
              />
            ) : (
              <>
                <h3 className="truncate text-sm font-bold text-[#111827]">
                  {video.title}
                </h3>
                <button
                  type="button"
                  onClick={handlePencilClick}
                  className="shrink-0 text-[#94A3B8] transition-colors hover:text-[#64748B]"
                  aria-label={`${video.title} 제목 수정`}
                >
                  <Pencil size={12} strokeWidth={2} />
                </button>
              </>
            )}
          </div>

          <p className="mt-1.5 text-xs font-medium text-[#94A3B8]">{video.date}</p>
        </div>

        <div ref={menuRef} className="relative ml-1">
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
    </article>
  );
}
