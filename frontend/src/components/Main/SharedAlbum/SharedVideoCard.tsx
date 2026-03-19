// 공유 앨범 영상 카드 컴포넌트
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Clock3, Ellipsis, Trash2, MessageCircle, SmilePlus } from "lucide-react";
import type { SharedVideoItem } from "../../../types/sharedAlbum";
import VideoTitleEditor from "../Card/VideoTitleEditor";

const EMOJI_LIST = ["👍", "❤️", "😂", "😮", "😢"];

type SharedVideoCardProps = {
  video: SharedVideoItem;
  onReact: (videoId: number, emoji: string) => void;
  onRenameTitle?: (videoId: number, newTitle: string) => void;
  onDelete?: (videoId: number) => void;
};

export default function SharedVideoCard({ video, onReact, onRenameTitle, onDelete }: SharedVideoCardProps) {
  const navigate = useNavigate();
  const [showMenu, setShowMenu] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const emojiRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showMenu) return;
    const handle = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowMenu(false);
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [showMenu]);

  useEffect(() => {
    if (!showEmojiPicker) return;
    const handle = (e: MouseEvent) => {
      if (emojiRef.current && !emojiRef.current.contains(e.target as Node)) setShowEmojiPicker(false);
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [showEmojiPicker]);

  // count > 0인 반응만 표시
  const visibleReactions = video.reactions.filter((r) => r.count > 0);

  return (
    <article className="group overflow-hidden rounded-[22px] border border-[#E5EAF1] bg-white shadow-sm transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
      {/* 썸네일 영역 */}
      <div
        className="relative aspect-video cursor-pointer overflow-hidden bg-[#0F172A]"
        onClick={() => navigate("/viewer", { state: { video: { ...video, uploadedBy: video.uploadedBy } } })}
      >
        <img
          src={video.thumbnail}
          alt={video.title}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105 group-hover:opacity-80"
        />
        {/* 재생 버튼 */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-black/40 backdrop-blur-sm border border-white/40">
            <svg viewBox="0 0 24 24" fill="white" className="h-5 w-5 ml-0.5">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>
        {/* 재생시간 뱃지 */}
        {video.duration && (
          <div className="absolute bottom-2 right-2 flex items-center gap-1 rounded-md bg-black/60 px-1.5 py-0.5 text-[11px] font-semibold text-white backdrop-blur-sm">
            <Clock3 size={11} strokeWidth={2} />
            <span>{video.duration}</span>
          </div>
        )}
      </div>

      {/* 하단 정보 영역 */}
      <div className="flex flex-col px-3.5 pt-2.5 pb-2">
        {/* 업로더 + 제목 + 메뉴 */}
        <div className="flex items-center justify-between">
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            <div
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
              style={{ backgroundColor: video.uploadedBy.avatarColor }}
            >
              {video.uploadedBy.name[0]}
            </div>
            <div className="min-w-0">
              <VideoTitleEditor
                title={video.title}
                onCommit={(newTitle) => onRenameTitle?.(video.id, newTitle)}
                accentColor="#10B981"
              />
              <p className="text-[11px] font-medium text-[#94A3B8]">
                {video.uploadedBy.isMe ? "나" : video.uploadedBy.name} · {video.date}
              </p>
            </div>
          </div>

          {/* 내 영상일 때만 메뉴 */}
          {video.uploadedBy.isMe && (
            <div ref={menuRef} className="relative flex-shrink-0">
              <button
                type="button"
                onClick={() => setShowMenu((prev) => !prev)}
                className="flex h-7 w-7 items-center justify-center rounded-full text-[#94A3B8] transition-colors hover:bg-[#F3F4F6] hover:text-[#64748B]"
              >
                <Ellipsis size={15} strokeWidth={2} />
              </button>
              {showMenu && (
                <div className="absolute right-0 top-9 z-20 w-32 rounded-xl border border-[#E5E7EB] bg-white p-1.5 shadow-lg">
                  <button
                    type="button"
                    onClick={() => { setShowMenu(false); onDelete?.(video.id); }}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-[#DC2626] transition-colors hover:bg-[#FEF2F2]"
                  >
                    <Trash2 size={14} strokeWidth={2} />
                    <span>삭제</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 반응 + 댓글 수 */}
        <div className="mt-2 flex items-center justify-between border-t border-[#F1F5F9] pt-2">
          {/* 반응 이모지 목록 + 추가 버튼 */}
          <div className="flex items-center gap-1 flex-wrap">
            {visibleReactions.map((r) => (
              <button
                key={r.emoji}
                type="button"
                onClick={() => onReact(video.id, r.emoji)}
                className={[
                  "flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-semibold transition-all",
                  r.reacted
                    ? "bg-[#ECFDF5] text-[#059669] ring-1 ring-[#6EE7B7]"
                    : "bg-[#F8FAFC] text-[#475569] hover:bg-[#F1F5F9]",
                ].join(" ")}
              >
                <span>{r.emoji}</span>
                <span className="tabular-nums">{r.count}</span>
              </button>
            ))}

            {/* 이모지 추가 버튼 */}
            <div ref={emojiRef} className="relative">
              <button
                type="button"
                onClick={() => setShowEmojiPicker((p) => !p)}
                className="flex h-6 w-6 items-center justify-center rounded-full text-[#94A3B8] transition-colors hover:bg-[#F1F5F9] hover:text-[#64748B]"
                title="반응 추가"
              >
                <SmilePlus size={13} strokeWidth={2} />
              </button>
              {showEmojiPicker && (
                <div className="absolute left-0 bottom-8 z-20 flex gap-1 rounded-2xl border border-[#E5E7EB] bg-white px-2 py-1.5 shadow-lg">
                  {EMOJI_LIST.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => { onReact(video.id, emoji); setShowEmojiPicker(false); }}
                      className="flex h-8 w-8 items-center justify-center rounded-xl text-lg transition-all hover:bg-[#F1F5F9] hover:scale-110"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 댓글 수 */}
          <button
            type="button"
            onClick={() => navigate("/viewer", { state: { video: { ...video, uploadedBy: video.uploadedBy } } })}
            className="flex items-center gap-1 text-[11px] font-medium text-[#94A3B8] transition-colors hover:text-[#64748B]"
          >
            <MessageCircle size={12} strokeWidth={2} />
            <span>{video.commentCount}</span>
          </button>
        </div>
      </div>
    </article>
  );
}
