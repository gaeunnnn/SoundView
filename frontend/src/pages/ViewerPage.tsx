// 영상 재생 페이지
import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { MessageCircle, X } from "lucide-react";
import type { ViewerVideo } from "../types/viewer";
import ViewerHeader from "../components/Viewer/ViewerHeader";
import VideoPlayer from "../components/Viewer/VideoPlayer";
import CommentSection from "../components/Viewer/CommentSection";

export default function ViewerPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const video = location.state?.video as ViewerVideo | undefined;
  const [showComments, setShowComments] = useState(false);

  if (!video) { navigate("/main", { replace: true }); return null; }

  return (
    <div className="flex h-screen flex-col bg-[#FAFBFD] overflow-hidden">
      <ViewerHeader onBack={() => navigate(-1)} />

      {/* 데스크톱: 플레이어 + 댓글 나란히 / 모바일: 플레이어 전체 */}
      <div className="flex flex-1 overflow-hidden">
        <VideoPlayer video={video} />
        {/* 댓글 패널 — 데스크톱 전용 */}
        <div className="hidden md:flex">
          <CommentSection videoId={video.id} />
        </div>
      </div>

      {/* 모바일 댓글 토글 버튼 */}
      <button
        type="button"
        onClick={() => setShowComments(true)}
        className="md:hidden fixed bottom-5 right-5 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-[#2563EB] text-white shadow-lg"
      >
        <MessageCircle size={20} strokeWidth={2} />
      </button>

      {/* 모바일 댓글 드로어 */}
      {showComments && (
        <div className="md:hidden fixed inset-0 z-50 flex flex-col">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setShowComments(false)}
          />
          <div className="absolute bottom-0 left-0 right-0 h-[70vh] rounded-t-2xl bg-white flex flex-col shadow-xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-[#E8EDF4] px-5 py-3 shrink-0">
              <span className="text-sm font-bold text-[#1E293B]">댓글</span>
              <button
                type="button"
                onClick={() => setShowComments(false)}
                className="flex h-7 w-7 items-center justify-center rounded-full text-[#94A3B8] hover:bg-[#F1F5F9]"
              >
                <X size={16} />
              </button>
            </div>
            <div className="flex flex-1 overflow-hidden">
              <CommentSection videoId={video.id} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
