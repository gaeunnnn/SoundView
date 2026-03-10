// 다른 페이지로 이동했을 때 떠있는 업로드 진행 PiP 팝업
import { useLocation, useNavigate } from "react-router-dom";
import { X, Upload } from "lucide-react";
import { useUpload } from "../../context/UploadContext";

export default function UploadProgressPip() {
  const { status, progress, fileName, resetUpload } = useUpload();
  const location = useLocation();
  const navigate = useNavigate();

  // 업로드 중이 아니거나 업로드 페이지에 있으면 숨김
  if (status !== "uploading" || location.pathname === "/upload") return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 w-72 rounded-2xl border border-[#E2E8F0] bg-white shadow-2xl">
      {/* 헤더 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#F1F5F9]">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#EFF6FF]">
            <Upload size={13} className="text-[#2563EB]" strokeWidth={2.5} />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-[#111827] truncate max-w-[140px]">
              {fileName}
            </p>
            <p className="text-[10px] text-[#94A3B8]">AI 자막 생성 중</p>
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
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-xs text-[#64748B]">처리 중...</span>
          <span className="text-xs font-semibold text-[#2563EB]">{progress}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-[#F1F5F9]">
          <div
            className="h-full rounded-full bg-[#2563EB] transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}
