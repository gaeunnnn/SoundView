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

export function VideosProvider({ children }: { children: React.ReactNode }) {
  const [videos, setVideos] = useState<VideoItem[]>([]);

  // GET /api/albums/{albumId}/videos — 앨범 영상 목록을 불러와 상태에 저장
  const fetchVideos = async (albumId: number) => {
    try {
      const data = await getAlbumVideos(albumId);
      setVideos(
        data.map((v) => ({
          id: v.videoId,
          title: v.title,
          thumbnail: v.thumbnailUrl ?? "",
          duration: v.durationSec != null ? formatDuration(v.durationSec) : "",
          date: v.createdAt.slice(0, 10).replace(/-/g, "."),
          uploaderName: v.uploaderName,
        }))
      );
    } catch {
      setVideos([]);
    }
  };

  const addVideo = (video: VideoItem) => {
    setVideos((prev) => [video, ...prev]);
  };

  const removeVideo = (id: number) => {
    setVideos((prev) => prev.filter((v) => v.id !== id));
    deleteVideo(id).catch(console.error);
  };

  // PATCH /api/videos/{videoId} — 영상 제목 수정 후 로컬 상태 반영
  const renameVideo = async (id: number, title: string) => {
    await updateVideoTitle(id, title);
    setVideos((prev) => prev.map((v) => (v.id === id ? { ...v, title } : v)));
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
