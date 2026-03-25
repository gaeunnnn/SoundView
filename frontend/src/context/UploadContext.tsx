// 업로드 진행 상태를 전역으로 관리하는 컨텍스트
import { createContext, useContext, useState } from "react";

type UploadStatus = "idle" | "uploading" | "processing" | "done";

type UploadContextValue = {
  status: UploadStatus;
  progress: number;
  fileName: string;
  uploadedVideoUrl: string | null;
  uploadedFileType: string;
  uploadedVideoId: number | null;       // videos.id
  uploadedAlbumVideoId: number | null;  // album_videos.id (COMPLETED 후 세팅)
  uploadedTitle: string;
  setUploadedVideo: (url: string, fileType: string) => void;
  setUploadedVideoId: (videoId: number) => void;
  setUploadedAlbumVideoId: (albumVideoId: number) => void;
  setUploadedTitle: (title: string) => void;
  startUpload: (fileName: string) => void;
  updateProgress: (progress: number) => void;
  finishUpload: () => void;
  startProcessing: () => void;
  doneUpload: () => void;
  resetUpload: () => void;
};

const UploadContext = createContext<UploadContextValue | null>(null);

export function UploadProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [fileName, setFileName] = useState("");
  const [uploadedVideoUrl, setUploadedVideoUrl] = useState<string | null>(null);
  const [uploadedFileType, setUploadedFileType] = useState("");
  const [uploadedVideoId, setUploadedVideoIdState] = useState<number | null>(null);
  const [uploadedAlbumVideoId, setUploadedAlbumVideoIdState] = useState<number | null>(null);
  const [uploadedTitle, setUploadedTitleState] = useState("");

  const setUploadedVideo = (url: string, fileType: string) => {
    setUploadedVideoUrl(url);
    setUploadedFileType(fileType);
  };

  const setUploadedVideoId = (videoId: number) => setUploadedVideoIdState(videoId);
  const setUploadedAlbumVideoId = (albumVideoId: number) => setUploadedAlbumVideoIdState(albumVideoId);
  const setUploadedTitle = (title: string) => setUploadedTitleState(title);

  const startUpload = (name: string) => {
    setFileName(name);
    setProgress(0);
    setStatus("uploading");
    setUploadedVideoIdState(null);
    setUploadedAlbumVideoIdState(null);
    setUploadedTitleState("");
  };

  const updateProgress = (value: number) => setProgress(value);

  const finishUpload = () => {
    setProgress(100);
    setStatus("uploading");
  };

  const startProcessing = () => {
    setStatus("processing");
  };

  const doneUpload = () => {
    setStatus("done");
  };

  const resetUpload = () => {
    setStatus("idle");
    setProgress(0);
    setFileName("");
  };

  return (
    <UploadContext.Provider
      value={{
        status, progress, fileName, uploadedVideoUrl, uploadedFileType,
        uploadedVideoId, uploadedAlbumVideoId, uploadedTitle,
        setUploadedVideo, setUploadedVideoId, setUploadedAlbumVideoId, setUploadedTitle,
        startUpload, updateProgress, finishUpload, startProcessing, doneUpload, resetUpload,
      }}
    >
      {children}
    </UploadContext.Provider>
  );
}

export function useUpload() {
  const ctx = useContext(UploadContext);
  if (!ctx) throw new Error("useUpload must be used within UploadProvider");
  return ctx;
}
