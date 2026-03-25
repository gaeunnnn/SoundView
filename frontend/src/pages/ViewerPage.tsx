// 영상 재생 페이지
import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import type { ViewerVideo, EmojiReaction } from "../types/viewer";
import ViewerHeader from "../components/Viewer/ViewerHeader";
import VideoPlayer from "../components/Viewer/VideoPlayer";
import CommentSection from "../components/Viewer/CommentSection";
import { addVideoReaction, deleteVideoReaction, getVideoFull } from "../api/video";
import type { CommentItem } from "../api/comment";

const PRESET_EMOJIS: EmojiReaction[] = [
  { emoji: "👍", count: 0, reacted: false },
  { emoji: "❤️", count: 0, reacted: false },
  { emoji: "😂", count: 0, reacted: false },
  { emoji: "🔥", count: 0, reacted: false },
  { emoji: "😮", count: 0, reacted: false },
];

export default function ViewerPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const initialVideo = location.state?.video as ViewerVideo | undefined;
  const isMyAlbum = location.state?.isMyAlbum as boolean | undefined;
  const [video, setVideo] = useState<ViewerVideo | undefined>(initialVideo);
  const [reactions, setReactions] = useState<EmojiReaction[]>(PRESET_EMOJIS);
  const [comments, setComments] = useState<CommentItem[]>([]);

  useEffect(() => {
    if (!initialVideo) return;
    setVideo(initialVideo);
    getVideoFull(initialVideo.id).then((res) => {
      // 댓글 초기화
      setComments(res.comments ?? []);
      // 리액션 초기화
      const serverReactions = res.reactionSummary?.reactions ?? [];
      setReactions(PRESET_EMOJIS.map((preset) => {
        const found = serverReactions.find((r) => r.emoji === preset.emoji);
        return found ? { emoji: found.emoji, count: found.count, reacted: found.selected } : preset;
      }));
      // 서버 URL로 video 보완 (videoUrl, subtitleUrl, soundEventUrl, vibrationBinaryUrl)
      setVideo((prev) => prev ? {
        ...prev,
        videoUrl: res.video.videoUrl ?? prev.videoUrl ?? undefined,
        subtitleUrl: res.video.subtitleUrl,
        soundEventUrl: res.video.soundEventUrl,
        vibrationBinaryUrl: res.video.vibrationBinaryUrl,
      } : prev);
    }).catch((e) => { console.error("[ViewerPage] getVideoFull 실패:", e); });
  }, [initialVideo?.id]);

  if (!video) { navigate("/main", { replace: true }); return null; }

  const uploaderLabel = video.uploadedBy
    ? (video.uploadedBy.isMe ? "나" : video.uploadedBy.name)
    : "나";

  const handleReact = async (emoji: string) => {
    const target = reactions.find((r) => r.emoji === emoji);
    if (!target) return;

    console.log("[리액션] videoId:", video.id, "emoji:", emoji, "현재 reacted:", target.reacted);

    if (target.reacted) {
      // 이미 반응한 경우 → DELETE 호출 후 count 감소
      try {
        await deleteVideoReaction(video.id, emoji);
        setReactions((prev) =>
          prev.map((r) =>
            r.emoji === emoji
              ? { ...r, reacted: false, count: Math.max(0, r.count - 1) }
              : r
          )
        );
      } catch (err) {
        console.error("[리액션 삭제 실패]", err);
      }
    } else {
      // 아직 반응하지 않은 경우 → POST 호출 후 서버 응답의 count 반영
      try {
        const res = await addVideoReaction(video.id, emoji);
        setReactions((prev) =>
          prev.map((r) =>
            r.emoji === emoji
              ? { ...r, reacted: true, count: res.count }
              : r
          )
        );
      } catch (err) {
        console.error("[리액션 추가 실패]", err);
      }
    }
  };

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#0F172A]">
      <ViewerHeader onBack={() => navigate(-1)} />

      {/* 데스크톱: 플레이어(좌) + 우측패널(우) */}
      <div className="flex flex-1 overflow-hidden">
        {/* 좌: 비디오 플레이어 — 남은 공간 전부 */}
        <VideoPlayer video={video} reactions={reactions} onReact={handleReact} />

        {/* 우: 메타 + 댓글(이모지 포함) — 내 앨범에서는 숨김 */}
        {!isMyAlbum && (
          <div className="flex w-80 shrink-0 flex-col border-l border-[#E8EDF4] bg-white overflow-hidden">
            {/* 영상 메타 */}
            <div className="shrink-0 border-b border-[#E8EDF4] px-4 py-3">
              <h2 className="text-sm font-bold text-[#1E293B] leading-snug truncate">{video.title}</h2>
              <p className="mt-0.5 text-xs text-[#64748B]">{uploaderLabel} · {video.date}</p>
            </div>

            {/* 댓글 + 이모지 통합 */}
            <CommentSection videoId={video.id} initialComments={comments} reactions={reactions} onReact={handleReact} />
          </div>
        )}
      </div>
     </div>
  );
}
