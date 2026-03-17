// 영상 재생 페이지 우측 댓글 패널 컴포넌트 파일
import { useEffect, useState } from "react";
import { Send, Trash2 } from "lucide-react";
import { getVideoComments, postVideoComment, deleteComment } from "../../api/comment";
import { useUser } from "../../context/UserContext";

type CommentItem = {
  id: number;
  authorName: string;
  authorColor: string;
  isMe: boolean;
  text: string;
  timeAgo: string;
};

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

type CommentSectionProps = {
  videoId: number;
};

export default function CommentSection({ videoId }: CommentSectionProps) {
  const { me } = useUser();
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [commentInput, setCommentInput] = useState("");

  useEffect(() => {
    getVideoComments(videoId)
      .then((data) => {
        setComments(
          data.map((c) => ({
            id: c.commentId,
            authorName: c.userNickname,
            authorColor: getColor(c.userNickname),
            isMe: c.userNickname === me?.nickname,
            text: c.content,
            timeAgo: formatTimeAgo(c.createdAt),
          }))
        );
      })
      .catch(() => {});
  }, [videoId]);

  const handleSend = async () => {
    const trimmed = commentInput.trim();
    if (!trimmed) return;
    try {
      const created = await postVideoComment(videoId, trimmed);
      setComments((prev) => [
        {
          id: created.commentId,
          authorName: created.userNickname,
          authorColor: getColor(created.userNickname),
          isMe: true,
          text: created.content,
          timeAgo: "방금",
        },
        ...prev,
      ]);
      setCommentInput("");
    } catch {}
  };

  const handleDelete = async (id: number) => {
    await deleteComment(id).catch(() => {});
    setComments((prev) => prev.filter((c) => c.id !== id));
  };

  const myInitial = me?.nickname?.[0] ?? "나";
  const myColor = me ? getColor(me.nickname) : "#8B5CF6";

  return (
    <div className="flex w-full md:w-80 md:shrink-0 flex-col border-l border-[#E8EDF4] bg-white">
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
        {comments.length === 0 && (
          <p className="text-center text-sm text-[#94A3B8] pt-6">첫 댓글을 남겨보세요.</p>
        )}
        {comments.map((c) => (
          <div key={c.id} className="group flex items-start gap-2.5">
            <div
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
              style={{ backgroundColor: c.authorColor }}
            >
              {c.authorName[0]}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-[#334155]">{c.authorName}</span>
                <span className="text-[10px] text-[#94A3B8]">{c.timeAgo}</span>
              </div>
              <p className="mt-0.5 wrap-break-word text-sm text-[#475569]">{c.text}</p>
            </div>
            {c.isMe && (
              <button
                type="button"
                onClick={() => handleDelete(c.id)}
                className="mt-0.5 shrink-0 text-[#CBD5E1] opacity-0 transition-all group-hover:opacity-100 hover:text-[#EF4444]"
              >
                <Trash2 size={13} />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
