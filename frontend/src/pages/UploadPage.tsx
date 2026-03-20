// 영상 업로드 페이지
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, CloudUpload, CheckCircle2, Loader2 } from "lucide-react";
import HeaderActionGroup from "../components/Main/Header/HeaderActionGroup";
import HeaderProfileButton from "../components/Main/Header/HeaderProfileButton";
import { useUpload } from "../context/UploadContext";
import { useUser } from "../context/UserContext";
import logoIcon from "../assets/images/LogoIcon.png";

const STAGES = [
  { minProgress: 0,  maxProgress: 20,  label: "영상을 업로드하는 중입니다...",          sub: "파일을 서버로 전송하고 있습니다" },
  { minProgress: 20, maxProgress: 50,  label: "AI가 영상을 분석하고 있습니다...",       sub: "영상 속 소리를 감지하고 있습니다" },
  { minProgress: 50, maxProgress: 80,  label: "음성을 인식하고 있습니다...",            sub: "AI가 영상 속 소리를 분석 중입니다" },
  { minProgress: 80, maxProgress: 99,  label: "자막을 생성하고 있습니다...",            sub: "인식된 음성을 자막으로 변환 중입니다" },
  { minProgress: 100, maxProgress: 100, label: "완료! 결과 플레이어로 전환합니다.",     sub: "AI가 영상 속 소리를 분석 중입니다" },
];

const STEP_ICONS = ["📁", "🔊", "🔥", "😊", "✅"];

function getStage(progress: number) {
  if (progress >= 100) return STAGES[4];
  return STAGES.find((s) => progress >= s.minProgress && progress < s.maxProgress) ?? STAGES[0];
}

export default function UploadPage() {
  const navigate = useNavigate();
  const { me } = useUser();
  const { status, progress, setUploadedVideo, startUpload, updateProgress, finishUpload, resetUpload } = useUpload();

  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 업로드 완료 시 자막 수정 페이지로 이동
  useEffect(() => {
    if (status === "done") {
      const timer = setTimeout(() => {
        resetUpload();
        navigate("/edit");
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [status, navigate, resetUpload]);

  // 언마운트 시 interval 정리
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const handleFile = (file: File) => {
    setSelectedFile(file);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    setUploadedVideo(url, file.type);
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

  const handleStartUpload = () => {
    if (!selectedFile) return;
    startUpload(selectedFile.name);

    // 진행률 시뮬레이션 (~10초)
    let current = 0;
    intervalRef.current = setInterval(() => {
      current += 1;
      if (current >= 100) {
        current = 100;
        clearInterval(intervalRef.current!);
        finishUpload();
      }
      updateProgress(Math.floor(current));
    }, 100);
  };

  const handleReset = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    resetUpload();
    setSelectedFile(null);
    setPreviewUrl(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const isUploading = status === "uploading" || status === "done";
  const stage = getStage(progress);
  const isDone = status === "done";
  const currentStageIndex = isDone ? 4 : STAGES.findIndex((s) => progress >= s.minProgress && progress < s.maxProgress);

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

          {/* 업로드 / 처리 영역 (16:9) */}
          {isUploading ? (
            /* 업로드 진행 중 */
            <div className="overflow-hidden rounded-2xl border border-[#E2E8F0] bg-black">
              <div className="relative aspect-video w-full">
                {/* 미리보기 (이미지/영상 모두 img로 표시) */}
                {previewUrl ? (
                  <img
                    src={previewUrl}
                    alt="preview"
                    className="h-full w-full object-cover opacity-40"
                  />
                ) : (
                  <div className="h-full w-full bg-[#0F172A]" />
                )}

                {/* 상태 오버레이 */}
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/50">
                  {isDone ? (
                    <CheckCircle2 size={48} className="text-[#10B981]" strokeWidth={1.5} />
                  ) : (
                    <Loader2 size={48} className="animate-spin text-[#60A5FA]" strokeWidth={1.5} />
                  )}
                  <div className="text-center">
                    <p className="text-lg font-semibold text-white">
                      {isDone ? "✅ " : ""}{stage.label}
                    </p>
                    <p className="mt-1 text-sm text-[#94A3B8]">{stage.sub}</p>
                  </div>
                </div>
              </div>

              {/* 하단 진행률 바 */}
              <div className="bg-white px-5 py-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-[#374151] truncate max-w-[70%]">
                    {isDone ? "✅ " : ""}{stage.label}
                  </span>
                  <span className="text-sm font-bold text-[#2563EB] tabular-nums">{progress}%</span>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-[#F1F5F9]">
                  <div
                    className="h-full rounded-full bg-[#2563EB] transition-all duration-500"
                    style={{ width: `${progress}%` }}
                  />
                </div>

                {/* 단계 아이콘 */}
                <div className="mt-3 flex items-center gap-3">
                  {STEP_ICONS.map((icon, i) => (
                    <span
                      key={i}
                      className={[
                        "flex h-8 w-8 items-center justify-center rounded-full text-base transition-all",
                        i <= currentStageIndex
                          ? "bg-[#EFF6FF] opacity-100"
                          : "bg-[#F8FAFC] opacity-30",
                      ].join(" ")}
                    >
                      {icon}
                    </span>
                  ))}
                  {!isDone && (
                    <span className="ml-auto text-xs text-[#94A3B8]">
                      1분 이상 소요될 수 있습니다
                    </span>
                  )}
                </div>
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
                accept="*/*"
                className="hidden"
                onChange={handleInputChange}
              />

              {selectedFile ? (
                /* 파일 선택 완료 */
                <div className="flex flex-col items-center gap-4 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#D1FAE5]">
                    <CheckCircle2 size={30} className="text-[#059669]" strokeWidth={1.5} />
                  </div>
                  <div>
                    <p className="text-base font-semibold text-[#111827]">{selectedFile.name}</p>
                    <p className="mt-1 text-sm text-[#64748B]">
                      {formatSize(selectedFile.size)}
                    </p>
                  </div>
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
                      onClick={(e) => { e.stopPropagation(); handleStartUpload(); }}
                      className="flex items-center gap-2 rounded-xl bg-[#2563EB] px-5 py-2 text-sm font-semibold text-white hover:bg-[#1D4ED8]"
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
                      MP4, MOV, AVI 지원 · 최대 2GB
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
