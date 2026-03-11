// 내 앨범에서 공유 앨범으로 영상 가져오기 모달
import { useState } from "react";
import { X, LogIn } from "lucide-react";
import type { VideoItem } from "../../../types/video";

type ImportVideoModalProps = {
  isOpen: boolean;
  myVideos: VideoItem[];
  onClose: () => void;
  onConfirm: (selectedVideos: VideoItem[]) => void;
};

export default function ImportVideoModal({
  isOpen,
  myVideos,
  onClose,
  onConfirm,
}: ImportVideoModalProps) {
  const [selected, setSelected] = useState<number[]>([]);

  if (!isOpen) return null;

  const toggle = (id: number) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]
    );
  };

  const handleClose = () => {
    setSelected([]);
    onClose();
  };

  const handleConfirm = () => {
    if (selected.length === 0) return;
    onConfirm(myVideos.filter((v) => selected.includes(v.id)));
    handleClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={handleClose}
    >
      <div
        className="relative w-full max-w-md rounded-3xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-start justify-between px-6 pt-6 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#ECFDF5]">
              <LogIn size={18} className="text-[#059669]" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#1E293B]">
                내 앨범에서 가져오기
              </h2>
              <p className="text-xs text-[#94A3B8]">가져올 영상을 선택하세요</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="flex h-7 w-7 items-center justify-center rounded-full text-[#94A3B8] hover:bg-[#F1F5F9]"
          >
            <X size={16} />
          </button>
        </div>

        {/* 영상 목록 */}
        <div className="max-h-[400px] overflow-y-auto px-3">
          {myVideos.map((video, idx) => {
            const isChecked = selected.includes(video.id);
            return (
              <button
                key={video.id}
                type="button"
                onClick={() => toggle(video.id)}
                className={[
                  "flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors hover:bg-[#F8FAFC]",
                  idx !== myVideos.length - 1
                    ? "border-b border-[#F1F5F9]"
                    : "",
                ].join(" ")}
              >
                {/* 썸네일 */}
                <div className="relative h-14 w-20 shrink-0 overflow-hidden rounded-xl bg-[#E5E7EB]">
                  <img
                    src={video.thumbnail}
                    alt={video.title}
                    className="h-full w-full object-cover"
                  />
                  <span className="absolute bottom-1 right-1 rounded bg-black/60 px-1 text-[9px] font-semibold text-white">
                    {video.duration}
                  </span>
                </div>

                {/* 정보 */}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-[#1E293B]">
                    {video.title}
                  </p>
                  <p className="mt-0.5 text-xs text-[#94A3B8]">{video.date}</p>
                </div>

                {/* 체크박스 */}
                <div
                  className={[
                    "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                    isChecked
                      ? "border-[#059669] bg-[#059669]"
                      : "border-[#CBD5E1] bg-white",
                  ].join(" ")}
                >
                  {isChecked && (
                    <svg
                      width="9"
                      height="7"
                      viewBox="0 0 9 7"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M1 3L3.5 5.5L8 1"
                        stroke="white"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* 푸터 */}
        <div className="flex items-center justify-between border-t border-[#F1F5F9] px-6 py-4">
          <span className="text-sm text-[#94A3B8]">
            {selected.length === 0
              ? "영상을 선택하세요"
              : `${selected.length}개 선택됨`}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleClose}
              className="rounded-xl bg-[#F1F5F9] px-5 py-2 text-sm font-medium text-[#475569] hover:bg-[#E2E8F0]"
            >
              취소
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={selected.length === 0}
              className="rounded-xl bg-[#059669] px-5 py-2 text-sm font-medium text-white hover:bg-[#047857] disabled:opacity-40 disabled:pointer-events-none"
            >
              가져오기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
