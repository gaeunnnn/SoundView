// 영상 업로드 페이지
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, CloudUpload, CheckCircle2, Loader2 } from "lucide-react";
import HeaderActionGroup from "../components/Main/Header/HeaderActionGroup";
import HeaderProfileButton from "../components/Main/Header/HeaderProfileButton";
import { useUpload } from "../context/UploadContext";
import { useUser } from "../context/UserContext";
import logoIcon from "../assets/images/LogoIcon.png";
import { uploadVideoMultipart } from "../utils/uploadMultipart";
import { getVideoStatus } from "../api/video";

export default function UploadPage() {
  const navigate = useNavigate();
  const { me } = useUser();
  const { status, progress, uploadedVideoId, setUploadedVideo, setUploadedVideoId, setUploadedTitle, startUpload, updateProgress, finishUpload, startProcessing, doneUpload, resetUpload } = useUpload();

  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [videoTitle, setVideoTitle] = useState("");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [showDoneModal, setShowDoneModal] = useState(false);

  const handleFile = (file: File) => {
    if (!file.type.startsWith("video/")) {
      setUploadError("영상 파일만 업로드할 수 있습니다.");
      return;
    }
    setSelectedFile(file);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    setUploadedVideo(url, file.type);
    setVideoTitle(file.name.replace(/\.[^/.]+$/, ""));
    setUploadError(null);
  };

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const handleStartUpload = async () => {
    if (!selectedFile || !videoTitle.trim()) return;
    setUploadError(null);
    startUpload(selectedFile.name);
    try {
      const videoId = await uploadVideoMultipart(selectedFile, videoTitle.trim(), (p) => updateProgress(p));
      setUploadedVideoId(videoId);
      setUploadedTitle(videoTitle.trim());
      finishUpload();
      startProcessing();
      setShowDoneModal(true);
      setTimeout(() => setShowDoneModal(false), 5000);
    } catch (error) {
      resetUpload();
      setUploadError(error instanceof Error ? error.message : "업로드 중 오류가 발생했습니다.");
    }
  };

  const handleReset = () => {
    resetUpload();
    setSelectedFile(null);
    setPreviewUrl(null);
    setVideoTitle("");
    setUploadError(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  // processing 상태에서 uploadedVideoId 기반 폴링 (UploadPage에 머물 때)
  useEffect(() => {
    if (status !== "processing" || !uploadedVideoId) return;
    const interval = setInterval(async () => {
      try {
        const videoStatus = await getVideoStatus(uploadedVideoId);
        if (videoStatus === "COMPLETED") {
          clearInterval(interval);
          doneUpload();
          navigate("/edit");
        } else if (videoStatus === "FAILED") {
          clearInterval(interval);
          resetUpload();
        }
      } catch {}
    }, 3000);
    return () => clearInterval(interval);
  }, [status, uploadedVideoId]);

  const isUploading = status === "uploading";
  const isProcessing = status === "processing";
  const isDone = status === "done";

  const formatSize = (bytes: number) => {
    if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="h-screen flex flex-col bg-[#FAFBFD] overflow-hidden">
      {/* 헤더 */}
      <div className="flex h-[72px] shrink-0 items-center justify-between border-b border-[#E8EDF4] bg-white px-5 shadow-sm">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => navigate("/main")}
            className="flex items-center gap-2.5 rounded-lg px-2 py-1 transition-colors hover:bg-[#F8FAFC]"
          >
            <img src={logoIcon} alt="SoundView 로고" className="h-14 w-14 object-contain" />
            <span className="hidden sm:block text-[22px] font-semibold tracking-[-0.02em] text-[#0F172A]">SoundView</span>
          </button>
          <div className="hidden sm:block h-4 w-px bg-[#E8EDF4]" />
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-sm font-medium text-[#64748B] transition-colors hover:text-[#111827]"
          >
            <ArrowLeft size={15} strokeWidth={2} />
            <span className="hidden sm:inline">뒤로가기</span>
          </button>
        </div>
        <div className="flex items-center gap-3">
          <HeaderActionGroup />
          <HeaderProfileButton userName={me?.nickname ?? ""} userCode={me?.userCode} profileImageUrl={me?.profileImageUrl} />
        </div>
      </div>

      {/* 콘텐츠 */}
      <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6 sm:py-8">
        <div className="mx-auto max-w-4xl">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-[#111827]">AI 자막 생성</h1>
            <p className="mt-1.5 text-sm text-[#64748B]">영상을 업로드하면 AI가 자동으로 자막을 생성합니다</p>
          </div>

          {isDone ? (
            /* AI 처리 완료 */
            <div className="overflow-hidden rounded-2xl border border-[#E2E8F0] bg-black">
              <div className="relative aspect-video w-full">
                {previewUrl ? (
                  <img src={previewUrl} alt="preview" className="h-full w-full object-cover opacity-20" />
                ) : (
                  <div className="h-full w-full bg-[#0F172A]" />
                )}
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/50">
                  <CheckCircle2 size={48} className="text-[#34D399]" strokeWidth={1.5} />
                  <div className="text-center px-4">
                    <p className="text-lg font-semibold text-white">AI 처리 완료!</p>
                    <p className="mt-1 text-sm text-[#94A3B8]">자막·이모지·진동 데이터가 생성되었습니다</p>
                  </div>
                </div>
              </div>
              <div className="bg-white px-5 py-4">
                <p className="text-sm font-medium text-[#059669]">✅ 자막·이모지·진동 데이터 생성 완료</p>
              </div>
            </div>
          ) : isProcessing ? (
            /* AI 처리 중 */
            <div className="overflow-hidden rounded-2xl border border-[#E2E8F0] bg-black">
              <div className="relative aspect-video w-full">
                {previewUrl ? (
                  <img src={previewUrl} alt="preview" className="h-full w-full object-cover opacity-20" />
                ) : (
                  <div className="h-full w-full bg-[#0F172A]" />
                )}
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/50">
                  <Loader2 size={48} className="animate-spin text-[#34D399]" strokeWidth={1.5} />
                  <div className="text-center px-4">
                    <p className="text-lg font-semibold text-white">AI 처리 중...</p>
                    <p className="mt-1 text-sm text-[#94A3B8]">자막·이모지·진동 데이터를 생성하고 있습니다</p>
                  </div>
                </div>
              </div>
              <div className="bg-white px-5 py-4">
                <div className="flex items-center gap-2 mb-1">
                  {["🎬", "📝", "😊", "📳"].map((icon) => (
                    <span key={icon} className="text-base">{icon}</span>
                  ))}
                  <span className="text-sm text-[#64748B] ml-1">처리 중...</span>
                </div>
                <p className="text-xs text-[#94A3B8]">처리가 완료되면 알림으로 알려드립니다</p>
              </div>
            </div>
          ) : isUploading ? (
            /* 업로드 진행 중 */
            <div className="overflow-hidden rounded-2xl border border-[#E2E8F0] bg-black">
              <div className="relative aspect-video w-full">
                {previewUrl ? (
                  <img src={previewUrl} alt="preview" className="h-full w-full object-cover opacity-30" />
                ) : (
                  <div className="h-full w-full bg-[#0F172A]" />
                )}
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/50">
                  <Loader2 size={48} className="animate-spin text-[#60A5FA]" strokeWidth={1.5} />
                  <div className="text-center px-4">
                    <p className="text-lg font-semibold text-white">
                      {progress < 90 ? "영상 업로드 중..." : "업로드 마무리 중..."}
                    </p>
                    <p className="mt-1 text-sm text-[#94A3B8]">파일을 서버로 전송하고 있습니다</p>
                  </div>
                </div>
              </div>
              <div className="bg-white px-5 py-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-[#374151]">업로드 중...</span>
                  <span className="text-sm font-bold text-[#2563EB] tabular-nums">{progress}%</span>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-[#F1F5F9]">
                  <div
                    className="h-full rounded-full bg-[#2563EB] transition-all duration-500"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="mt-1.5 text-xs text-[#94A3B8]">업로드 완료 후 AI가 자막·이모지·진동 데이터를 생성합니다</p>
              </div>
            </div>
          ) : (
            /* 파일 선택 영역 */
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => !selectedFile && inputRef.current?.click()}
              className={[
                "relative flex min-h-[240px] sm:aspect-video w-full cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed transition-colors",
                isDragging ? "border-[#2563EB] bg-[#EFF6FF]"
                  : selectedFile ? "border-[#10B981] bg-[#F0FDF9] cursor-default"
                  : "border-[#CBD5E1] bg-white hover:border-[#93C5FD] hover:bg-[#F8FAFF]",
              ].join(" ")}
            >
              <input ref={inputRef} type="file" accept="video/*" className="hidden" onChange={handleInputChange} />

              {selectedFile ? (
                <div className="flex flex-col items-center gap-4 text-center w-full max-w-sm px-4">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#D1FAE5]">
                    <CheckCircle2 size={30} className="text-[#059669]" strokeWidth={1.5} />
                  </div>
                  <div>
                    <p className="text-base font-semibold text-[#111827]">{selectedFile.name}</p>
                    <p className="mt-1 text-sm text-[#64748B]">{formatSize(selectedFile.size)}</p>
                  </div>
                  {uploadError && (
                    <p className="w-full rounded-xl bg-[#FEF2F2] px-3 py-2 text-left text-xs text-[#DC2626]">{uploadError}</p>
                  )}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleReset(); }}
                      className="rounded-xl border border-[#E2E8F0] bg-white px-4 py-2 text-sm font-medium text-[#475569] hover:bg-[#F8FAFC]"
                    >
                      다시 선택
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); void handleStartUpload(); }}
                      className="flex items-center gap-2 rounded-xl bg-[#2563EB] px-5 py-2 text-sm font-semibold text-white hover:bg-[#1D4ED8]"
                    >
                      <CloudUpload size={14} strokeWidth={2.5} />
                      자막 생성 시작
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-4 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#F1F5F9]">
                    <CloudUpload size={30} className="text-[#94A3B8]" strokeWidth={1.5} />
                  </div>
                  <div>
                    <p className="text-base font-medium text-[#374151]">영상을 드래그하거나 클릭하여 업로드</p>
                    <p className="mt-1.5 text-sm text-[#94A3B8]">MP4, MOV, AVI, MKV 등 모든 영상 형식 지원 · 최대 2GB</p>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); inputRef.current?.click(); }}
                    className="mt-1 flex items-center gap-2 rounded-xl bg-[#2563EB] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#1D4ED8]"
                  >
                    <CloudUpload size={15} strokeWidth={2.5} />
                    영상 업로드
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 업로드 완료 팝업 */}
      {showDoneModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          onClick={() => setShowDoneModal(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#ECFDF5]">
                <CheckCircle2 size={32} className="text-[#10B981]" strokeWidth={1.5} />
              </div>
              <h2 className="text-lg font-bold text-[#111827]">업로드 완료!</h2>
              <p className="text-sm text-[#64748B]">
                AI가 자막·이모지·진동 데이터를 생성하고 있습니다.<br />
                다른 화면으로 이동해도 백그라운드에서 계속 진행됩니다.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
