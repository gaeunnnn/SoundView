// 영상 재생 페이지 우측 댓글 패널 컴포넌트 파일
import { useState } from "react";
import { Send, Trash2 } from "lucide-react";
import type { Comment } from "../../types/viewer";

const DUMMY_COMMENTS: Comment[] = [
  { id: 1, authorName: "김지은", authorColor: "#14B8A6", isMe: false, text: "한강이래!", timeAgo: "3일 전" },
  { id: 2, authorName: "박민준", authorColor: "#8B5CF6", isMe: true, text: "이거 어디서 찍은 거야?", timeAgo: "4일 전" },
  { id: 3, authorName: "김지은", authorColor: "#14B8A6", isMe: false, text: "불꽃놀이 영상 대박이다!! 🎆", timeAgo: "4일 전" },
];

export default function CommentSection() {
  const [comments, setComments] = useState<Comment[]>(DUMMY_COMMENTS);
  const [commentInput, setCommentInput] = useState("");

  const handleSend = () => {
    const trimmed = commentInput.trim();
    if (!trimmed) return;
    setComments((prev) => [
      { id: Date.now(), authorName: "박민준", authorColor: "#8B5CF6", isMe: true, text: trimmed, timeAgo: "방금" },
      ...prev,
    ]);
    setCommentInput("");
  };

  const handleDelete = (id: number) => setComments((prev) => prev.filter((c) => c.id !== id));

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
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#8B5CF6] text-xs font-bold text-white">박</div>
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
