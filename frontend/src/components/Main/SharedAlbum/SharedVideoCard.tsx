// 공유 앨범 영상 카드 컴포넌트
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Clock3, MessageCircle, Pencil, Plus } from "lucide-react";
import type { EmojiReaction, SharedVideoItem } from "../../../types/sharedAlbum";

const AVAILABLE_EMOJIS = ["🔥", "❤️", "😆", "🥹", "👍", "😍"];

type SharedVideoCardProps = {
  video: SharedVideoItem;
  onReact: (videoId: number, emoji: string) => void;
  onRenameTitle?: (videoId: number, newTitle: string) => void;
};

export default function SharedVideoCard({ video, onReact, onRenameTitle }: SharedVideoCardProps) {
  const navigate = useNavigate();
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(video.title);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing) inputRef.current?.focus();
  }, [isEditing]);

  const handleTitleCommit = () => {
    const trimmed = editTitle.trim();
    if (trimmed && trimmed !== video.title) {
      onRenameTitle?.(video.id, trimmed);
    } else {
      setEditTitle(video.title);
    }
    setIsEditing(false);
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") handleTitleCommit();
    if (e.key === "Escape") { setEditTitle(video.title); setIsEditing(false); }
  };

  const reactedEmojis = new Set(
    video.reactions.filter((r) => r.reacted).map((r) => r.emoji)
  );

  const visibleReactions = video.reactions.filter(
    (r) => r.count > 0 || r.reacted
  );

  const availableToAdd = AVAILABLE_EMOJIS.filter(
    (e) => !reactedEmojis.has(e)
  );

  return (
    <article className="rounded-[22px] border border-[#E5EAF1] bg-white">
      {/* 썸네일 */}
      <div
        className="relative aspect-video cursor-pointer overflow-hidden rounded-t-[22px] bg-[#E5E7EB]"
        onClick={() => navigate("/viewer", { state: { video: { ...video, uploadedBy: video.uploadedBy } } })}
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

      <div className="px-3 pb-3 pt-3">
        {/* 제목 */}
        <div className="flex items-center gap-1.5">
          {isEditing ? (
            <input
              ref={inputRef}
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onBlur={handleTitleCommit}
              onKeyDown={handleTitleKeyDown}
              placeholder={video.title}
              className="w-full rounded-lg border border-[#10B981] px-2 py-0.5 text-sm font-bold text-[#111827] outline-none ring-2 ring-[#10B981]/20 placeholder:text-[#CBD5E1]"
            />
          ) : (
            <>
              <h3 className="truncate text-sm font-bold text-[#111827]">
                {video.title}
              </h3>
              <button
                type="button"
                onClick={() => { setEditTitle(video.title); setIsEditing(true); }}
                className="shrink-0 text-[#94A3B8] transition-colors hover:text-[#64748B]"
                aria-label={`${video.title} 제목 수정`}
              >
                <Pencil size={12} strokeWidth={2} />
              </button>
            </>
          )}
        </div>

        {/* 날짜 + 업로더 */}
        <div className="mt-1.5 flex items-center gap-2">
          <span className="text-xs text-[#94A3B8]">{video.date}</span>
          <div className="flex items-center gap-1.5">
            <div
              className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white"
              style={{ backgroundColor: video.uploadedBy.avatarColor }}
            >
              {video.uploadedBy.name[0]}
            </div>
            <span className="text-xs font-medium text-[#64748B]">
              {video.uploadedBy.isMe ? "나" : video.uploadedBy.name}
            </span>
          </div>
        </div>

        {/* 이모지 반응 */}
        <div className="mt-3 flex items-center justify-between">
          <div className="flex items-center gap-1.5 flex-wrap">
            {visibleReactions.map((reaction: EmojiReaction) => (
              <button
                key={reaction.emoji}
                type="button"
                onClick={() => onReact(video.id, reaction.emoji)}
                className={[
                  "flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
                  reaction.reacted
                    ? "bg-[#EEF4FF] text-[#2563EB] ring-1 ring-[#BFDBFE]"
                    : "bg-[#F1F5F9] text-[#475569] hover:bg-[#E2E8F0]",
                ].join(" ")}
              >
                <span>{reaction.emoji}</span>
                {reaction.count > 0 && <span>{reaction.count}</span>}
              </button>
            ))}

            {/* 이모지 추가 버튼 */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowEmojiPicker((prev) => !prev)}
                className="flex h-7 w-7 items-center justify-center rounded-full bg-[#F1F5F9] text-[#94A3B8] transition-colors hover:bg-[#E2E8F0] hover:text-[#64748B]"
              >
                <Plus size={13} strokeWidth={2.5} />
              </button>

              {showEmojiPicker && (
                <div className="absolute bottom-9 left-0 z-20 flex gap-1 rounded-2xl border border-[#E8EDF4] bg-white p-2 shadow-lg">
                  {availableToAdd.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => {
                        onReact(video.id, emoji);
                        setShowEmojiPicker(false);
                      }}
                      className="flex h-8 w-8 items-center justify-center rounded-xl text-lg transition-colors hover:bg-[#F1F5F9]"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 댓글 */}
          <button
            type="button"
            className="flex items-center gap-1.5 text-xs text-[#94A3B8] transition-colors hover:text-[#64748B]"
          >
            <MessageCircle size={13} strokeWidth={2} />
            <span>댓글 {video.commentCount}</span>
          </button>
        </div>
      </div>
    </article>
  );
}
