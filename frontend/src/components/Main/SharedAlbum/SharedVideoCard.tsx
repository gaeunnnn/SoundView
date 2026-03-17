// 공유 앨범 영상 카드 컴포넌트
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MessageCircle, Plus, Ellipsis, Pencil, Trash2 } from "lucide-react";
import type { EmojiReaction, SharedVideoItem } from "../../../types/sharedAlbum";
import VideoThumbnail from "../Card/VideoThumbnail";
import VideoTitleEditor from "../Card/VideoTitleEditor";

const AVAILABLE_EMOJIS = ["🔥", "❤️", "😆", "🥹", "👍", "😍"];

type SharedVideoCardProps = {
  video: SharedVideoItem;
  onReact: (videoId: number, emoji: string) => void;
  onRenameTitle?: (videoId: number, newTitle: string) => void;
  onDelete?: (videoId: number) => void;
};

export default function SharedVideoCard({ video, onReact, onRenameTitle, onDelete }: SharedVideoCardProps) {
  const navigate = useNavigate();
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const reactedEmojis = new Set(video.reactions.filter((r) => r.reacted).map((r) => r.emoji));
  const visibleReactions = video.reactions.filter((r) => r.count > 0 || r.reacted);
  const availableToAdd = AVAILABLE_EMOJIS.filter((e) => !reactedEmojis.has(e));

  useEffect(() => {
    if (!showMenu) return;
    const handle = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [showMenu]);

  return (
    <article className="rounded-[22px] border border-[#E5EAF1] bg-white">
      <VideoThumbnail
        src={video.thumbnail}
        alt={video.title}
        duration={video.duration}
        onClick={() => navigate("/viewer", { state: { video: { ...video, uploadedBy: video.uploadedBy } } })}
      />

      <div className="px-3 pb-3 pt-3">
        {/* 제목 행 */}
        <div className="flex items-center gap-1.5">
          <div className="min-w-0 flex-1">
            <VideoTitleEditor
              title={video.title}
              onCommit={(newTitle) => onRenameTitle?.(video.id, newTitle)}
              accentColor="#10B981"
            />
          </div>

          {/* 내 영상일 때만 점3개 메뉴 */}
          {video.uploadedBy.isMe && (
            <div ref={menuRef} className="relative shrink-0">
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
                    onClick={() => { setShowMenu(false); onRenameTitle?.(video.id, video.title); }}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-[#111827] transition-colors hover:bg-[#F3F4F6]"
                  >
                    <Pencil size={14} strokeWidth={2} />
                    <span>수정</span>
                  </button>
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

        {/* 날짜 + 업로더 행 */}
        <div className="mt-1.5 flex h-5 items-center gap-2">
          <span className="shrink-0 text-xs text-[#94A3B8]">{video.date}</span>
          <div className="flex items-center gap-1.5">
            <div
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
              style={{ backgroundColor: video.uploadedBy.avatarColor }}
            >
              {video.uploadedBy.name[0]}
            </div>
            <span className="truncate text-xs font-medium text-[#64748B]">
              {video.uploadedBy.isMe ? "나" : video.uploadedBy.name}
            </span>
          </div>
        </div>

        {/* 이모지 반응 + 댓글 행 */}
        <div className="mt-3 flex min-h-[28px] items-center justify-between">
          <div className="flex items-center gap-1.5">
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
                      onClick={() => { onReact(video.id, emoji); setShowEmojiPicker(false); }}
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
            className="flex shrink-0 items-center gap-1.5 text-xs text-[#94A3B8] transition-colors hover:text-[#64748B]"
          >
            <MessageCircle size={13} strokeWidth={2} />
            <span>댓글 {video.commentCount}</span>
          </button>
        </div>
      </div>
    </article>
  );
}
