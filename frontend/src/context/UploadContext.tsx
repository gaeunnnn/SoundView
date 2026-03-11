// 업로드 진행 상태를 전역으로 관리하는 컨텍스트
import { createContext, useContext, useState } from "react";

type UploadStatus = "idle" | "uploading" | "done";

type UploadContextValue = {
  status: UploadStatus;
  progress: number;
  fileName: string;
  uploadedVideoUrl: string | null;
  uploadedFileType: string;
  setUploadedVideo: (url: string, fileType: string) => void;
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

  const setUploadedVideo = (url: string, fileType: string) => {
    setUploadedVideoUrl(url);
    setUploadedFileType(fileType);
  };

  const startUpload = (name: string) => {
    setFileName(name);
    setProgress(0);
    setStatus("uploading");
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
  };

  return (
    <UploadContext.Provider
      value={{ status, progress, fileName, uploadedVideoUrl, uploadedFileType, setUploadedVideo, startUpload, updateProgress, finishUpload, resetUpload }}
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
