// 전체 영상 목록을 전역으로 관리하는 컨텍스트
import { createContext, useContext, useState } from "react";
import type { VideoItem } from "../types/video";
import { getAlbumVideos } from "../api/album";
import { updateVideoTitle, deleteVideo } from "../api/video";

type VideosContextValue = {
  videos: VideoItem[];
  fetchVideos: (albumId: number) => Promise<void>;
  addVideo: (video: VideoItem) => void;
  removeVideo: (id: number) => void;
  renameVideo: (id: number, title: string) => void;
};

const VideosContext = createContext<VideosContextValue | null>(null);

// durationSec(초)를 "M:SS" 형식 문자열로 변환
function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

const DEMO_VIDEO: VideoItem = {
  id: -1,
  videoId: -1,
  title: "데모 영상",
  date: "2026.03.23",
  duration: "0:24",
  thumbnail: "",
  uploaderName: "나",
  videoUrl: "/demo/test.mp4",
};

export function VideosProvider({ children }: { children: React.ReactNode }) {
  const [videos, setVideos] = useState<VideoItem[]>([DEMO_VIDEO]);

  // GET /api/albums/{albumId}/videos — 앨범 영상 목록을 불러와 상태에 저장
  const fetchVideos = async (albumId: number) => {
    if (!albumId || albumId <= 0 || !Number.isFinite(albumId)) return;
    console.log("[fetchVideos] 호출됨 albumId:", albumId);
    try {
      const data = await getAlbumVideos(albumId);
      console.log("[fetchVideos] 응답 영상 수:", data.length, data);
      const fetched = data.map((v) => ({
        id: v.videoId,
        videoId: v.videoId,
        title: v.title,
        thumbnail: v.thumbnailUrl ?? "",
        duration: v.durationSec != null ? formatDuration(v.durationSec) : "",
        date: v.createdAt.slice(0, 10).replace(/-/g, "."),
        uploaderName: v.uploaderName,
      }));
      setVideos([DEMO_VIDEO, ...fetched]);
    } catch (e) {
      console.error("[fetchVideos] 실패:", e);
      setVideos([DEMO_VIDEO]);
    }
  };

  const addVideo = (video: VideoItem) => {
    setVideos((prev) => [video, ...prev]);
  };

  const removeVideo = (id: number) => {
    const target = videos.find((v) => v.id === id);
    setVideos((prev) => prev.filter((v) => v.id !== id));
    // 데모 영상(id=-1)은 API 호출하지 않음
    if (target && target.videoId > 0) deleteVideo(target.videoId).catch(console.error);
  };

  // PATCH /api/videos/{videoId} — 영상 제목 수정 후 로컬 상태 반영
  const renameVideo = async (id: number, title: string) => {
    const target = videos.find((v) => v.id === id);
    // 낙관적 업데이트: 먼저 로컬 상태 반영
    setVideos((prev) => prev.map((v) => (v.id === id ? { ...v, title } : v)));
    // 데모 영상(id=-1)은 API 호출하지 않음
    if (!target || target.videoId <= 0) return;
    try {
      await updateVideoTitle(target.videoId, title);
    } catch (err) {
      console.error("[renameVideo] API 실패 — videoId:", target.videoId, err);
      // 실패 시 원래 제목으로 롤백
      setVideos((prev) => prev.map((v) => (v.id === id ? { ...v, title: target.title } : v)));
    }
  };

  return (
    <VideosContext.Provider value={{ videos, fetchVideos, addVideo, removeVideo, renameVideo }}>
      {children}
    </VideosContext.Provider>
  );
}

export function useVideos() {
  const ctx = useContext(VideosContext);
  if (!ctx) throw new Error("useVideos must be used within VideosProvider");
  return ctx;
}
