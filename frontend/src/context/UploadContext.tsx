// 업로드 진행 상태를 전역으로 관리하는 컨텍스트
import { createContext, useContext, useState } from "react";

type UploadStatus = "idle" | "uploading" | "done";

type UploadContextValue = {
  status: UploadStatus;
  progress: number;
  fileName: string;
  uploadedVideoUrl: string | null;
  uploadedFileType: string;
  uploadedVideoId: number | null;
  uploadedTitle: string;
  setUploadedVideo: (url: string, fileType: string) => void;
  setUploadedVideoId: (videoId: number) => void;
  setUploadedTitle: (title: string) => void;
  startUpload: (fileName: string) => void;
  updateProgress: (progress: number) => void;
  finishUpload: () => void;
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
  const [uploadedTitle, setUploadedTitleState] = useState("");

  const setUploadedVideo = (url: string, fileType: string) => {
    setUploadedVideoUrl(url);
    setUploadedFileType(fileType);
  };

  const setUploadedVideoId = (videoId: number) => setUploadedVideoIdState(videoId);
  const setUploadedTitle = (title: string) => setUploadedTitleState(title);

  const startUpload = (name: string) => {
    setFileName(name);
    setProgress(0);
    setStatus("uploading");
    // 새 업로드 시작 시 이전 업로드 결과 초기화
    setUploadedVideoIdState(null);
    setUploadedTitleState("");
  };

  const updateProgress = (value: number) => setProgress(value);

  const finishUpload = () => {
    setProgress(100);
    setStatus("done");
  };

  const resetUpload = () => {
    setStatus("idle");
    setProgress(0);
    setFileName("");
    // uploadedVideoId와 uploadedTitle은 EditPage에서 사용하므로 여기서 초기화하지 않음
    // 새 업로드 시작(startUpload) 시 초기화됨
  };

  return (
    <UploadContext.Provider
      value={{ status, progress, fileName, uploadedVideoUrl, uploadedFileType, uploadedVideoId, uploadedTitle, setUploadedVideo, setUploadedVideoId, setUploadedTitle, startUpload, updateProgress, finishUpload, resetUpload }}
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
