// 영상 재생 페이지
import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import type { ViewerVideo, EmojiReaction } from "../types/viewer";
import ViewerHeader from "../components/Viewer/ViewerHeader";
import VideoPlayer from "../components/Viewer/VideoPlayer";
import CommentSection from "../components/Viewer/CommentSection";

const PRESET_EMOJIS: EmojiReaction[] = [
  { emoji: "👍", count: 2, reacted: false },
  { emoji: "❤️", count: 1, reacted: false },
  { emoji: "😂", count: 0, reacted: false },
  { emoji: "🔥", count: 3, reacted: false },
  { emoji: "😮", count: 0, reacted: false },
];

export default function ViewerPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const video = location.state?.video as ViewerVideo | undefined;
  const [reactions, setReactions] = useState<EmojiReaction[]>(PRESET_EMOJIS);

  if (!video) { navigate("/main", { replace: true }); return null; }

  const uploaderLabel = video.uploadedBy
    ? (video.uploadedBy.isMe ? "나" : video.uploadedBy.name)
    : "나";

  const handleReact = (emoji: string) => {
    setReactions((prev) =>
      prev.map((r) =>
        r.emoji === emoji
          ? { ...r, reacted: !r.reacted, count: r.reacted ? Math.max(0, r.count - 1) : r.count + 1 }
          : r
      )
    );
  };

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#0F172A]">
      <ViewerHeader onBack={() => navigate(-1)} />

      {/* 데스크톱: 플레이어(좌) + 우측패널(우) */}
      <div className="flex flex-1 overflow-hidden">
        {/* 좌: 비디오 플레이어 — 남은 공간 전부 */}
        <VideoPlayer video={video} reactions={reactions} onReact={handleReact} />

        {/* 우: 메타 + 댓글(이모지 포함) */}
        <div className="flex w-80 shrink-0 flex-col border-l border-[#E8EDF4] bg-white overflow-hidden">
          {/* 영상 메타 */}
          <div className="shrink-0 border-b border-[#E8EDF4] px-4 py-3">
            <h2 className="text-sm font-bold text-[#1E293B] leading-snug truncate">{video.title}</h2>
            <p className="mt-0.5 text-xs text-[#64748B]">{uploaderLabel} · {video.date}</p>
          </div>

          {/* 댓글 + 이모지 통합 */}
          <CommentSection videoId={video.id} reactions={reactions} onReact={handleReact} />
        </div>
      </div>
    </div>
  );
}
