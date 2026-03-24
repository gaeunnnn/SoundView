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

const UPLOAD_STAGES = [
  { minProgress: 0,  maxProgress: 90,  label: "영상을 업로드하는 중...",  sub: "파일을 서버로 전송하고 있습니다" },
  { minProgress: 90, maxProgress: 100, label: "업로드 마무리 중...",       sub: "잠시만 기다려 주세요" },
  { minProgress: 100, maxProgress: 100, label: "업로드 완료",              sub: "" },
];

// AI 처리 단계 — 순서대로 표시 (각 단계는 대략 순서대로 진행되지만 실제 완료는 COMPLETED 폴링으로 판단)
const AI_STEPS = [
  { icon: "🎬", label: "영상 분석 중" },
  { icon: "📝", label: "AI 자막 생성 중" },
  { icon: "😊", label: "이모지 생성 중" },
  { icon: "📳", label: "진동 데이터 생성 중" },
];

const POLL_INTERVAL_MS = 3000;
const POLL_MAX = 80; // 최대 4분

function getUploadStage(progress: number) {
  if (progress >= 100) return UPLOAD_STAGES[UPLOAD_STAGES.length - 1];
  return UPLOAD_STAGES.find((s) => progress >= s.minProgress && progress < s.maxProgress) ?? UPLOAD_STAGES[0];
}

export default function UploadPage() {
  const navigate = useNavigate();
  const { me } = useUser();
  const { status, progress, setUploadedVideo, setUploadedVideoId, setUploadedTitle, startUpload, updateProgress, finishUpload, startProcessing, doneUpload, resetUpload } = useUpload();

  const inputRef = useRef<HTMLInputElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [aiStepIndex, setAiStepIndex] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [videoTitle, setVideoTitle] = useState("");
  const [uploadError, setUploadError] = useState<string | null>(null);

  // AI 처리 중 단계 아이콘 순환 (4초 간격)
  useEffect(() => {
    if (status !== "processing") return;
    setAiStepIndex(0);
    const t = setInterval(() => {
      setAiStepIndex((prev) => (prev + 1) % AI_STEPS.length);
    }, 4000);
    return () => clearInterval(t);
  }, [status]);

  // AI 처리 완료 시 자막 수정 페이지로 이동
  useEffect(() => {
    if (status === "done") {
      const timer = setTimeout(() => {
        resetUpload();
        navigate("/edit");
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [status, navigate, resetUpload]);

  const handleFile = (file: File) => {
    // 영상 파일 형식 검증
    if (!file.type.startsWith("video/")) {
      setUploadError("영상 파일만 업로드할 수 있습니다.");
      return;
    }
    setSelectedFile(file);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    setUploadedVideo(url, file.type);
    // 파일명에서 확장자를 제거한 값을 기본 제목으로 설정
    setVideoTitle(file.name.replace(/\.[^/.]+$/, ""));
    setUploadError(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

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
      const videoId = await uploadVideoMultipart(selectedFile, videoTitle.trim(), (uploadProgress) => {
        updateProgress(uploadProgress);
      });
      setUploadedVideoId(videoId);
      setUploadedTitle(videoTitle.trim());
      finishUpload();

      // S3 업로드 완료 → AI 처리(PROCESSING) 폴링 시작
      startProcessing();
      let count = 0;
      const poll = async () => {
        try {
          const { status: videoStatus } = await getVideoStatus(videoId);
          if (videoStatus === "COMPLETED") {
            doneUpload();
            return;
          }
          if (videoStatus === "FAILED") {
            resetUpload();
            setUploadError("AI 처리 중 오류가 발생했습니다. 다시 시도해 주세요.");
            return;
          }
        } catch {
          // 일시적 네트워크 오류는 무시하고 계속 폴링
        }
        count += 1;
        if (count < POLL_MAX) {
          pollTimerRef.current = setTimeout(poll, POLL_INTERVAL_MS);
        } else {
          resetUpload();
          setUploadError("AI 처리 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요.");
        }
      };
      poll();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "업로드 중 오류가 발생했습니다.";
      resetUpload();
      setUploadError(message);
    }
  };

  const handleReset = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    resetUpload();
    setSelectedFile(null);
    setPreviewUrl(null);
    setVideoTitle("");
    setUploadError(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const isActive = status === "uploading" || status === "processing" || status === "done";
  const isProcessing = status === "processing";
  const isDone = status === "done";
  const uploadStage = getUploadStage(progress);

  const formatSize = (bytes: number) => {
    if (bytes >= 1024 * 1024 * 1024)
      return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
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
          {/* 타이틀 */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-[#111827]">AI 자막 생성</h1>
            <p className="mt-1.5 text-sm text-[#64748B]">
              영상을 업로드하면 AI가 자동으로 자막을 생성합니다
            </p>
          </div>

          {/* 업로드 / AI 처리 영역 */}
          {isActive ? (
            <div className="overflow-hidden rounded-2xl border border-[#E2E8F0] bg-black">
              {/* 미리보기 + 오버레이 */}
              <div className="relative aspect-video w-full">
                {previewUrl ? (
                  <img src={previewUrl} alt="preview" className="h-full w-full object-cover opacity-30" />
                ) : (
                  <div className="h-full w-full bg-[#0F172A]" />
                )}
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/50">
                  {isDone ? (
                    <CheckCircle2 size={48} className="text-[#10B981]" strokeWidth={1.5} />
                  ) : (
                    <Loader2 size={48} className="animate-spin text-[#60A5FA]" strokeWidth={1.5} />
                  )}
                  <div className="text-center px-4">
                    {isDone ? (
                      <p className="text-lg font-semibold text-white">✅ 처리 완료! 잠시 후 이동합니다.</p>
                    ) : isProcessing ? (
                      <>
                        <p className="text-lg font-semibold text-white">{AI_STEPS[aiStepIndex].icon} {AI_STEPS[aiStepIndex].label}</p>
                        <p className="mt-1 text-sm text-[#94A3B8]">AI가 영상을 분석하고 있습니다</p>
                      </>
                    ) : (
                      <>
                        <p className="text-lg font-semibold text-white">{uploadStage.label}</p>
                        <p className="mt-1 text-sm text-[#94A3B8]">{uploadStage.sub}</p>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* 하단 진행 정보 */}
              <div className="bg-white px-5 py-4">
                {isProcessing || isDone ? (
                  /* AI 처리 단계 */
                  <>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-semibold text-[#374151]">
                        {isDone ? "✅ AI 처리 완료" : "🤖 AI 처리 중..."}
                      </span>
                      {!isDone && (
                        <span className="text-xs text-[#94A3B8]">수 분 소요될 수 있습니다</span>
                      )}
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      {AI_STEPS.map((step, i) => (
                        <div
                          key={step.label}
                          className={[
                            "flex flex-col items-center gap-1.5 rounded-xl p-2 text-center transition-all",
                            isDone
                              ? "bg-[#ECFDF5]"
                              : i === aiStepIndex
                              ? "bg-[#EFF6FF] ring-1 ring-[#93C5FD]"
                              : i < aiStepIndex
                              ? "bg-[#F8FAFC]"
                              : "bg-[#F8FAFC] opacity-40",
                          ].join(" ")}
                        >
                          <span className="text-xl">{step.icon}</span>
                          <span className={[
                            "text-[10px] font-medium leading-tight",
                            isDone ? "text-[#059669]" : i <= aiStepIndex ? "text-[#374151]" : "text-[#94A3B8]",
                          ].join(" ")}>
                            {step.label}
                          </span>
                          {isDone && <span className="text-[10px] text-[#059669]">✓</span>}
                          {!isDone && i === aiStepIndex && (
                            <Loader2 size={10} className="animate-spin text-[#2563EB]" />
                          )}
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  /* 업로드 진행 단계 */
                  <>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-[#374151] truncate max-w-[70%]">
                        {uploadStage.label}
                      </span>
                      <span className="text-sm font-bold text-[#2563EB] tabular-nums">{progress}%</span>
                    </div>
                    <div className="h-2.5 w-full overflow-hidden rounded-full bg-[#F1F5F9]">
                      <div
                        className="h-full rounded-full bg-[#2563EB] transition-all duration-500"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <p className="mt-2 text-xs text-[#94A3B8]">업로드 완료 후 AI가 자막·이모지·진동 데이터를 생성합니다</p>
                  </>
                )}
              </div>
            </div>
          ) : (
            /* 초기 드래그 업로드 영역 */
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => !selectedFile && inputRef.current?.click()}
              className={[
                "relative flex min-h-[240px] sm:aspect-video w-full cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed transition-colors",
                isDragging
                  ? "border-[#2563EB] bg-[#EFF6FF]"
                  : selectedFile
                  ? "border-[#10B981] bg-[#F0FDF9] cursor-default"
                  : "border-[#CBD5E1] bg-white hover:border-[#93C5FD] hover:bg-[#F8FAFF]",
              ].join(" ")}
            >
              <input
                ref={inputRef}
                type="file"
                accept="video/*"
                className="hidden"
                onChange={handleInputChange}
              />

              {selectedFile ? (
                /* 파일 선택 완료 */
                <div className="flex flex-col items-center gap-4 text-center w-full max-w-sm px-4">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#D1FAE5]">
                    <CheckCircle2 size={30} className="text-[#059669]" strokeWidth={1.5} />
                  </div>
                  <div>
                    <p className="text-base font-semibold text-[#111827]">{selectedFile.name}</p>
                    <p className="mt-1 text-sm text-[#64748B]">
                      {formatSize(selectedFile.size)}
                    </p>
                  </div>
                  {/* 에러 메시지 */}
                  {uploadError && (
                    <p className="w-full rounded-xl bg-[#FEF2F2] px-3 py-2 text-left text-xs text-[#DC2626]">
                      {uploadError}
                    </p>
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
                      disabled={!selectedFile}
                      className="flex items-center gap-2 rounded-xl bg-[#2563EB] px-5 py-2 text-sm font-semibold text-white hover:bg-[#1D4ED8] disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <CloudUpload size={14} strokeWidth={2.5} />
                      자막 생성 시작
                    </button>
                  </div>
                </div>
              ) : (
                /* 기본 상태 */
                <div className="flex flex-col items-center gap-4 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#F1F5F9]">
                    <CloudUpload size={30} className="text-[#94A3B8]" strokeWidth={1.5} />
                  </div>
                  <div>
                    <p className="text-base font-medium text-[#374151]">
                      영상을 드래그하거나 클릭하여 업로드
                    </p>
                    <p className="mt-1.5 text-sm text-[#94A3B8]">
                      MP4, MOV, AVI, MKV 등 모든 영상 형식 지원 · 최대 2GB
                    </p>
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
    </div>
  );
}
