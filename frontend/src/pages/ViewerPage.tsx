// 영상 재생 페이지
import { useLocation, useNavigate } from "react-router-dom";
import type { ViewerVideo } from "../types/viewer";
import ViewerHeader from "../components/Viewer/ViewerHeader";
import VideoPlayer from "../components/Viewer/VideoPlayer";
import CommentSection from "../components/Viewer/CommentSection";

export default function ViewerPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const video = location.state?.video as ViewerVideo | undefined;

  if (!video) { navigate("/", { replace: true }); return null; }

  return (
    <div className="flex h-screen flex-col bg-[#FAFBFD] overflow-hidden">
      <ViewerHeader onBack={() => navigate(-1)} />
      <div className="flex flex-1 overflow-hidden">
        <VideoPlayer video={video} />
        <CommentSection />
      </div>
    </div>
  );
}
