// 다른 페이지로 이동했을 때 떠있는 업로드 진행 PiP 팝업
import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { X, Upload, Loader2, CheckCircle2 } from "lucide-react";
import { useUpload } from "../../context/UploadContext";
import { getVideoStatus } from "../../api/video";
import { getAlbums, getAlbumVideos } from "../../api/album";

export default function UploadProgressPip() {
  const { status, progress, fileName, uploadedVideoId, uploadedAlbumVideoId, setUploadedAlbumVideoId, doneUpload, resetUpload } = useUpload();
  const location = useLocation();
  const navigate = useNavigate();

  const handleDoneClick = async () => {
    if (uploadedAlbumVideoId) {
      resetUpload();
      navigate("/edit");
      return;
    }
    // albumVideoId 없으면 uploadedVideoId로 정확히 매칭
    try {
      const albums = await getAlbums();
      const myAlbum = albums.find((a) => a.memberCount === 1) ?? albums[0];
      if (myAlbum) {
        const videos = await getAlbumVideos(myAlbum.albumId);
        if (videos.length > 0) {
          const target = uploadedVideoId
            ? videos.find((v) => v.videoId === uploadedVideoId)
            : undefined;
          setUploadedAlbumVideoId((target ?? videos[0]).albumVideoId);
        }
      }
    } catch {}
    resetUpload();
    navigate("/edit");
  };

  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation();
    resetUpload();
  };

  // 드래그 상태
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const dragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const pipRef = useRef<HTMLDivElement>(null);

  // processing 상태에서 uploadedVideoId 기반 폴링
  useEffect(() => {
    if (status !== "processing" || !uploadedVideoId) return;

    const interval = setInterval(async () => {
      try {
        const videoStatus = await getVideoStatus(uploadedVideoId);
        if (videoStatus === "COMPLETED") {
          clearInterval(interval);
          doneUpload();
        } else if (videoStatus === "FAILED") {
          clearInterval(interval);
          resetUpload();
        }
      } catch {
        // 폴링 실패 시 계속 시도
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [status, uploadedVideoId]);

  // 드래그 핸들러
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!pipRef.current) return;
    dragging.current = true;
    const rect = pipRef.current.getBoundingClientRect();
    dragOffset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    e.preventDefault();
  };

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current || !pipRef.current) return;
      const { offsetWidth: w, offsetHeight: h } = pipRef.current;
      const x = Math.min(Math.max(0, e.clientX - dragOffset.current.x), window.innerWidth - w);
      const y = Math.min(Math.max(0, e.clientY - dragOffset.current.y), window.innerHeight - h);
      setPos({ x, y });
    };
    const onUp = () => { dragging.current = false; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  const isVisible =
    (status === "uploading" || status === "processing" || status === "done") &&
    location.pathname !== "/upload";

  if (!isVisible) return null;

  const isProcessing = status === "processing";
  const isDone = status === "done";

  const posStyle = pos
    ? { left: pos.x, top: pos.y, bottom: "auto", right: "auto" }
    : { bottom: 20, right: 20 };

  return (
    <div
      ref={pipRef}
      className={[
        "fixed z-50 w-72 rounded-2xl select-none transition-all duration-500",
        isDone
          ? "border border-[#6EE7B7] shadow-[0_0_0_4px_rgba(16,185,129,0.15),0_8px_32px_rgba(16,185,129,0.25)]"
          : "border border-[#E2E8F0] bg-white shadow-2xl",
      ].join(" ")}
      onClick={isDone ? handleDoneClick : undefined}
      style={{
        ...posStyle,
        position: "fixed",
        ...(isDone ? { background: "linear-gradient(135deg, #ECFDF5 0%, #F0FDF9 60%, #D1FAE5 100%)", cursor: "pointer" } : {}),
        animation: isDone ? "pip-done-pop 0.4s cubic-bezier(0.34,1.56,0.64,1) both" : undefined,
      }}
    >
      <style>{`
        @keyframes pip-done-pop {
          from { transform: scale(0.92); opacity: 0; }
          to   { transform: scale(1);    opacity: 1; }
        }
      `}</style>

      {/* 헤더 — 드래그 영역 */}
      <div
        className={["flex items-center justify-between px-4 py-3 cursor-grab active:cursor-grabbing", isDone ? "" : "border-b border-[#F1F5F9]"].join(" ")}
        onMouseDown={handleMouseDown}
      >
        <div className="flex items-center gap-2">
          <div className={["flex h-7 w-7 items-center justify-center rounded-lg", isDone ? "bg-[#D1FAE5]" : isProcessing ? "bg-[#ECFDF5]" : "bg-[#EFF6FF]"].join(" ")}>
            {isDone
              ? <CheckCircle2 size={13} className="text-[#059669]" strokeWidth={2.5} />
              : isProcessing
              ? <Loader2 size={13} className="animate-spin text-[#059669]" strokeWidth={2.5} />
              : <Upload size={13} className="text-[#2563EB]" strokeWidth={2.5} />
            }
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-[#111827] truncate max-w-[140px]">
              {fileName}
            </p>
            <p className={["text-[10px]", isDone ? "text-[#059669] font-semibold" : "text-[#94A3B8]"].join(" ")}>
              {isDone ? "AI 처리 완료! 🎉" : isProcessing ? "AI 자막·이모지·진동 생성 중" : "업로드 중..."}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={handleClose}
            className={["flex h-5 w-5 items-center justify-center rounded-full", isDone ? "text-[#059669] hover:bg-[#A7F3D0]" : "text-[#94A3B8] hover:bg-[#F1F5F9]"].join(" ")}
          >
            <X size={12} />
          </button>
        </div>
      </div>

      {/* 완료 시 본문 */}
      {isDone && (
        <button
          type="button"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); handleDoneClick(); }}
          className="w-full px-4 py-3 flex items-center gap-2 hover:bg-[#BBF7D0]/50 transition-colors rounded-b-2xl cursor-pointer"
        >
          {["🎬", "📝", "😊", "📳"].map((icon, i) => (
            <span
              key={icon}
              className="text-base"
              style={{ animation: `pip-done-pop 0.4s cubic-bezier(0.34,1.56,0.64,1) ${0.1 + i * 0.07}s both` }}
            >
              {icon}
            </span>
          ))}
          <span className="text-xs text-[#065F46] font-medium ml-1">클릭하여 편집하기 →</span>
        </button>
      )}

      {/* 진행률 */}
      {!isDone && (
        <div className="px-4 py-3">
          {isProcessing ? (
            <div className="flex items-center gap-2">
              <div className="flex gap-1">
                {["🎬", "📝", "😊", "📳"].map((icon) => (
                  <span key={icon} className="text-sm">{icon}</span>
                ))}
              </div>
              <span className="text-xs text-[#64748B]">처리 중...</span>
            </div>
          ) : (
            <>
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-xs text-[#64748B]">업로드 중...</span>
                <span className="text-xs font-semibold text-[#2563EB]">{progress}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-[#F1F5F9]">
                <div
                  className="h-full rounded-full bg-[#2563EB] transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
