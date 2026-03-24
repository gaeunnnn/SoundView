// 영상 재생 페이지 우측 댓글 패널 컴포넌트 파일
import { useEffect, useState } from "react";
import { Send, Trash2 } from "lucide-react";
import { addComment, deleteComment } from "../../api/comment";
import type { CommentItem } from "../../api/comment";
import { useUser } from "../../context/UserContext";
import type { EmojiReaction } from "../../types/viewer";

const COLORS = ["#8B5CF6", "#3B82F6", "#EC4899", "#F59E0B", "#10B981", "#EF4444", "#14B8A6"];

function getColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return COLORS[Math.abs(hash) % COLORS.length];
}

function formatTimeAgo(createdAt: string): string {
  const diff = Date.now() - new Date(createdAt).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "방금";
  if (mins < 60) return `${mins}분 전`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}시간 전`;
  return `${Math.floor(hours / 24)}일 전`;
}

type Props = {
  videoId: number;
  initialComments: CommentItem[];
  reactions: EmojiReaction[];
  onReact: (emoji: string) => void;
};

export default function CommentSection({ videoId, initialComments, reactions, onReact }: Props) {
  const { me } = useUser();
  const [comments, setComments] = useState<CommentItem[]>(initialComments);
  const [commentInput, setCommentInput] = useState("");

  useEffect(() => {
    setComments(initialComments);
  }, [initialComments]);

  const handleSend = async () => {
    const trimmed = commentInput.trim();
    if (!trimmed) return;
    setCommentInput("");
    try {
      const created = await addComment(videoId, trimmed);
      setComments((prev) => [created, ...prev]);
    } catch {}
  };

  const handleDelete = (commentId: number) => {
    setComments((prev) => prev.filter((c) => c.commentId !== commentId));
    deleteComment(commentId).catch(() => {});
  };

  const myNickname = me?.nickname ?? "";
  const myInitial = myNickname ? myNickname[0] : "나";
  const myColor = myNickname ? getColor(myNickname) : "#8B5CF6";

  return (
    <div className="flex w-full flex-1 flex-col overflow-hidden bg-white">
      {/* 헤더 */}
      <div className="flex items-center gap-2 border-b border-[#E8EDF4] px-4 py-2.5 shrink-0">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        <span className="text-xs font-semibold text-[#334155]">댓글</span>
        <span className="ml-1 rounded-full bg-[#F1F5F9] px-1.5 py-0.5 text-[10px] font-semibold text-[#64748B]">
          {comments.length}
        </span>
      </div>

      {/* 댓글 목록 */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {comments.length === 0 && (
          <p className="text-center text-xs text-[#94A3B8] pt-6">첫 댓글을 남겨보세요.</p>
        )}
        {comments.map((c) => {
          const isMe = c.userNickname === myNickname;
          const color = getColor(c.userNickname);
          return (
            <div key={c.commentId} className="group flex items-start gap-2.5">
              <div
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                style={{ backgroundColor: color }}
              >
                {c.userNickname[0]}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-[#334155]">{c.userNickname}</span>
                  <span className="text-[10px] text-[#94A3B8]">{formatTimeAgo(c.createdAt)}</span>
                </div>
                <p className="mt-0.5 break-words text-sm text-[#475569]">{c.content}</p>
              </div>
              {isMe && (
                <button
                  type="button"
                  onClick={() => handleDelete(c.commentId)}
                  className="mt-0.5 shrink-0 text-[#CBD5E1] opacity-0 transition-all group-hover:opacity-100 hover:text-[#EF4444]"
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* 이모지 반응 + 댓글 입력 — 하단 고정 */}
      <div className="shrink-0 border-t border-[#E8EDF4]">
        {/* 이모지 반응 버튼 행 */}
        <div className="flex items-center gap-1.5 px-3 pt-2.5 pb-1.5 flex-wrap">
          {reactions.map((r) => (
            <button
              key={r.emoji}
              type="button"
              onClick={() => onReact(r.emoji)}
              className={[
                "flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-all",
                r.reacted
                  ? "bg-[#DBEAFE] ring-1 ring-[#2563EB] text-[#2563EB]"
                  : "bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#475569]",
              ].join(" ")}
            >
              <span className="text-sm leading-none">{r.emoji}</span>
              {r.count > 0 && (
                <span className={r.reacted ? "text-[#2563EB]" : "text-[#94A3B8]"}>
                  {r.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* 댓글 입력창 */}
        <div className="flex items-center gap-2 px-3 pb-3 pt-1">
          <div
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
            style={{ backgroundColor: myColor }}
          >
            {myInitial}
          </div>
          <input
            type="text"
            placeholder="댓글 남기기..."
            value={commentInput}
            onChange={(e) => setCommentInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            className="flex-1 rounded-full bg-[#F1F5F9] px-3 py-1.5 text-sm text-[#1E293B] outline-none placeholder:text-[#CBD5E1] focus:bg-[#E8EDF4] transition-colors"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={!commentInput.trim()}
            className="text-[#CBD5E1] transition-colors hover:text-[#2563EB] disabled:pointer-events-none"
          >
            <Send size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}
