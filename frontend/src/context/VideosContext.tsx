// 전체 영상 목록을 전역으로 관리하는 컨텍스트
import { createContext, useContext, useState } from "react";
import type { VideoItem } from "../types/video";
import { VIDEO_LIST } from "../constants/videos";

type VideosContextValue = {
  videos: VideoItem[];
  addVideo: (video: VideoItem) => void;
  removeVideo: (id: number) => void;
  renameVideo: (id: number, title: string) => void;
};

const VideosContext = createContext<VideosContextValue | null>(null);

export function VideosProvider({ children }: { children: React.ReactNode }) {
  const [videos, setVideos] = useState<VideoItem[]>(VIDEO_LIST);

  const addVideo = (video: VideoItem) => {
    setVideos((prev) => [video, ...prev]);
  };

  const removeVideo = (id: number) => {
    setVideos((prev) => prev.filter((v) => v.id !== id));
  };

  const renameVideo = (id: number, title: string) => {
    setVideos((prev) => prev.map((v) => (v.id === id ? { ...v, title } : v)));
  };

  return (
    <VideosContext.Provider value={{ videos, addVideo, removeVideo, renameVideo }}>
      {children}
    </VideosContext.Provider>
  );
}

export function useVideos() {
  const ctx = useContext(VideosContext);
  if (!ctx) throw new Error("useVideos must be used within VideosProvider");
  return ctx;
}
