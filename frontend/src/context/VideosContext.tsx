// 전체 영상 목록을 전역으로 관리하는 컨텍스트
import { createContext, useContext, useState } from "react";
import type { VideoItem } from "../types/video";
import { getAlbumVideos } from "../api/album";
import { updateVideoTitle, deleteVideo } from "../api/video";

type VideosContextValue = {
  videos: VideoItem[];
  fetchVideos: (albumId: number) => Promise<void>;
  addVideo: (video: VideoItem) => void;
  removeVideo: (id: number) => Promise<void>;
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
  thumbnail: undefined,
  uploaderName: "나",
  videoUrl: "/demo/test.mp4",
};

export function VideosProvider({ children }: { children: React.ReactNode }) {
  const [videos, setVideos] = useState<VideoItem[]>([DEMO_VIDEO]);

  // GET /api/albums/{albumId}/videos — 앨범 영상 목록을 불러와 상태에 저장
  const fetchVideos = async (albumId: number) => {
    if (!albumId || albumId <= 0 || !Number.isFinite(albumId)) return;
    try {
      const data = await getAlbumVideos(albumId);
      const fetched = data.map((v) => ({
        id: v.albumVideoId,
        videoId: v.videoId ?? v.albumVideoId,
        title: v.title,
        thumbnail: v.thumbnailUrl ?? v.thumbnailS3Key ?? undefined,
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

  const removeVideo = async (id: number) => {
    const target = videos.find((v) => v.id === id);
    // 데모 영상(id=-1)은 API 호출하지 않음
    if (target && target.videoId > 0) {
      try {
        await deleteVideo(target.videoId);
      } catch (e) {
        console.error("[removeVideo] 삭제 실패:", e);
        return; // 실패 시 로컬 상태 변경하지 않음
      }
    }
    setVideos((prev) => prev.filter((v) => v.id !== id));
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
