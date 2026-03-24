// 다른 페이지로 이동했을 때 떠있는 업로드 진행 PiP 팝업
import { useLocation, useNavigate } from "react-router-dom";
import { X, Upload, Loader2 } from "lucide-react";
import { useUpload } from "../../context/UploadContext";

export default function UploadProgressPip() {
  const { status, progress, fileName, resetUpload } = useUpload();
  const location = useLocation();
  const navigate = useNavigate();

  if ((status !== "uploading" && status !== "processing") || location.pathname === "/upload") return null;

  const isProcessing = status === "processing";

  return (
    <div className="fixed bottom-5 right-5 z-50 w-72 rounded-2xl border border-[#E2E8F0] bg-white shadow-2xl">
      {/* 헤더 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#F1F5F9]">
        <div className="flex items-center gap-2">
          <div className={["flex h-7 w-7 items-center justify-center rounded-lg", isProcessing ? "bg-[#ECFDF5]" : "bg-[#EFF6FF]"].join(" ")}>
            {isProcessing
              ? <Loader2 size={13} className="animate-spin text-[#059669]" strokeWidth={2.5} />
              : <Upload size={13} className="text-[#2563EB]" strokeWidth={2.5} />
            }
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-[#111827] truncate max-w-[140px]">
              {fileName}
            </p>
            <p className="text-[10px] text-[#94A3B8]">
              {isProcessing ? "AI 자막·이모지·진동 생성 중" : "업로드 중..."}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => navigate("/upload")}
            className="text-[10px] font-medium text-[#2563EB] hover:text-[#1D4ED8]"
          >
            보기
          </button>
          <button
            type="button"
            onClick={resetUpload}
            className="flex h-5 w-5 items-center justify-center rounded-full text-[#94A3B8] hover:bg-[#F1F5F9]"
          >
            <X size={12} />
          </button>
        </div>
      </div>

      {/* 진행률 */}
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
    </div>
  );
}
