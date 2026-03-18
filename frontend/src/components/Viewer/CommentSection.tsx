// 영상 재생 페이지 우측 댓글 패널 컴포넌트 파일
import { useEffect, useState } from "react";
import { Send, Trash2 } from "lucide-react";
import { getComments, addComment, deleteComment } from "../../api/comment";
import type { CommentItem } from "../../api/comment";
import { useUser } from "../../context/UserContext";

const AVATAR_COLORS = ["#8B5CF6", "#3B82F6", "#EC4899", "#F59E0B", "#10B981", "#EF4444"];

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function formatTimeAgo(createdAt: string): string {
  const diff = Math.floor((Date.now() - new Date(createdAt).getTime()) / 1000);
  if (diff < 60) return "방금";
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
  return `${Math.floor(diff / 86400)}일 전`;
}

type Props = {
  videoId: number;
};

export default function CommentSection({ videoId }: Props) {
  const { me } = useUser();
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [commentInput, setCommentInput] = useState("");

  useEffect(() => {
    getComments(videoId).then(setComments).catch(console.error);
  }, [videoId]);

  const handleSend = async () => {
    const trimmed = commentInput.trim();
    if (!trimmed) return;
    setCommentInput("");
    try {
      const created = await addComment(videoId, trimmed);
      setComments((prev) => [created, ...prev]);
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = (commentId: number) => {
    setComments((prev) => prev.filter((c) => c.commentId !== commentId));
    deleteComment(commentId).catch(console.error);
  };

  const myNickname = me?.nickname ?? "";
  const avatarInitial = myNickname ? myNickname[0] : "나";

  return (
    <div className="flex w-80 shrink-0 flex-col border-l border-[#E8EDF4] bg-white">
      {/* 헤더 */}
      <div className="flex items-center gap-2 border-b border-[#E8EDF4] px-4 py-3">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        <span className="text-sm font-semibold text-[#334155]">댓글</span>
        <span className="ml-1 rounded-full bg-[#F1F5F9] px-2 py-0.5 text-xs font-semibold text-[#64748B]">
          {comments.length}
        </span>
      </div>

      {/* 입력창 */}
      <div className="flex items-center gap-2 border-b border-[#E8EDF4] px-3 py-2.5">
        <div
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
          style={{ backgroundColor: getAvatarColor(myNickname) }}
        >
          {avatarInitial}
        </div>
        <input
          type="text"
          placeholder="댓글 남기기..."
          value={commentInput}
          onChange={(e) => setCommentInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          className="flex-1 bg-transparent text-sm text-[#1E293B] outline-none placeholder:text-[#CBD5E1]"
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

      {/* 댓글 목록 */}
      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-3">
        {comments.map((c) => {
          const isMe = c.userNickname === myNickname;
          const color = getAvatarColor(c.userNickname);
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
                <p className="mt-0.5 wrap-break-word text-sm text-[#475569]">{c.content}</p>
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
    </div>
  );
}
