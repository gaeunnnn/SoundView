// 내 앨범 영상 카드 컴포넌트
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { Clock3, Ellipsis, Pencil, Share2, Trash2 } from "lucide-react";
import type { VideoItem } from "../../../types/video";
import VideoTitleEditor from "../Card/VideoTitleEditor";

type VideoCardProps = {
  video: VideoItem;
  onEdit: (videoId: number) => void;
  onShare: (videoId: number) => void;
  onDelete: (videoId: number) => void;
  onRenameTitle: (videoId: number, newTitle: string) => void;
};

export default function VideoCard({
  video,
  onEdit,
  onShare,
  onDelete,
  onRenameTitle,
}: VideoCardProps) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const updatePos = () => {
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setPos({ top: r.top - 124, left: r.right - 148 });
    }
  };

  const handleToggle = () => {
    if (!open) updatePos();
    setOpen((prev) => !prev);
  };

  useEffect(() => {
    if (!open) return;
    const handleScroll = () => updatePos();
    const handleClick = (e: MouseEvent) => {
      const t = e.target as Node;
      if (menuRef.current?.contains(t)) return;
      if (btnRef.current?.contains(t)) return;
      setOpen(false);
    };
    window.addEventListener("scroll", handleScroll, true);
    const timer = setTimeout(() => document.addEventListener("mousedown", handleClick), 0);
    return () => {
      window.removeEventListener("scroll", handleScroll, true);
      clearTimeout(timer);
      document.removeEventListener("mousedown", handleClick);
    };
  }, [open]);

  return (
    <article className="group overflow-hidden rounded-[22px] border border-[#E5EAF1] bg-white shadow-sm transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
      {/* 썸네일 영역 */}
      <div
        className="relative aspect-video cursor-pointer overflow-hidden bg-[#0F172A]"
        onClick={() => navigate("/viewer", { state: { video, isMyAlbum: true } })}
      >
        {video.thumbnail && (
          <img
            src={video.thumbnail}
            alt={video.title}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105 group-hover:opacity-80"
          />
        )}
        {/* 재생 버튼 — hover 시 중앙 */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-black/40 backdrop-blur-sm border border-white/40">
            <svg viewBox="0 0 24 24" fill="white" className="h-5 w-5 ml-0.5">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>
        {/* 재생시간 뱃지 */}
        <div className="absolute bottom-2 right-2 flex items-center gap-1 rounded-md bg-black/60 px-1.5 py-0.5 text-[11px] font-semibold text-white backdrop-blur-sm">
          <Clock3 size={11} strokeWidth={2} />
          <span>{video.duration}</span>
        </div>
      </div>

      {/* 하단 정보 영역 — 흰 배경 */}
      <div className="flex items-center justify-between px-3.5 py-2.5">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="flex min-w-0 items-center gap-1.5">
            <VideoTitleEditor
              title={video.title}
              onCommit={(newTitle) => onRenameTitle(video.id, newTitle)}
            />
          </div>
          <p className="text-[11px] font-medium text-[#94A3B8]">{video.date}</p>
        </div>
        <button
          ref={btnRef}
          type="button"
          onClick={handleToggle}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[#94A3B8] transition-colors hover:bg-[#F3F4F6] hover:text-[#64748B]"
          aria-label={`${video.title} 더보기`}
        >
          <Ellipsis size={15} strokeWidth={2} />
        </button>
      </div>

      {open && pos && createPortal(
        <div
          ref={menuRef}
          className="fixed z-[9999] w-[148px] rounded-xl border border-[#E5E7EB] bg-white p-1.5 shadow-lg"
          style={{ top: pos.top, left: pos.left }}
        >
          <button type="button" onClick={() => { onEdit(video.id); setOpen(false); }}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-[#111827] transition-colors hover:bg-[#F3F4F6]">
            <Pencil size={15} strokeWidth={2} /><span>편집</span>
          </button>
          <button type="button" onClick={() => { onShare(video.id); setOpen(false); }}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-[#111827] transition-colors hover:bg-[#F3F4F6]">
            <Share2 size={15} strokeWidth={2} /><span>공유</span>
          </button>
          <button type="button" onClick={() => { onDelete(video.id); setOpen(false); }}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-[#DC2626] transition-colors hover:bg-[#FEF2F2]">
            <Trash2 size={15} strokeWidth={2} /><span>삭제</span>
          </button>
        </div>,
        document.body
      )}
    </article>
  );
}
