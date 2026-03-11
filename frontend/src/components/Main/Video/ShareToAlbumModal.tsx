// 영상을 공유할 앨범을 선택하는 모달 컴포넌트
import { useState } from "react";
import { X, Share2, Check } from "lucide-react";
import type { SharedAlbumItem } from "../../../types/sidebar";

type ShareToAlbumModalProps = {
  isOpen: boolean;
  videoTitle: string;
  sharedAlbums: SharedAlbumItem[];
  onClose: () => void;
  onConfirm: (albumIds: number[]) => void;
};

export default function ShareToAlbumModal({
  isOpen,
  videoTitle,
  sharedAlbums,
  onClose,
  onConfirm,
}: ShareToAlbumModalProps) {
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  if (!isOpen) return null;

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleConfirm = () => {
    if (selectedIds.length === 0) return;
    onConfirm(selectedIds);
    setSelectedIds([]);
    onClose();
  };

  const handleClose = () => {
    setSelectedIds([]);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={handleClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-start justify-between px-6 pt-6 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EFF6FF]">
              <Share2 size={17} className="text-[#2563EB]" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#1E293B]">공유 앨범에 추가</h2>
              <p className="text-xs text-[#94A3B8] truncate max-w-[180px]">{videoTitle}</p>
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

        {/* 앨범 목록 */}
        <div className="px-6 pb-4">
          {sharedAlbums.length === 0 ? (
            <p className="py-6 text-center text-sm text-[#94A3B8]">
              공유 앨범이 없습니다.
            </p>
          ) : (
            <ul className="space-y-2">
              {sharedAlbums.map((album) => {
                const selected = selectedIds.includes(album.id);
                return (
                  <li key={album.id}>
                    <button
                      type="button"
                      onClick={() => toggleSelect(album.id)}
                      className={[
                        "flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors",
                        selected
                          ? "border-[#2563EB] bg-[#EFF6FF]"
                          : "border-[#E2E8F0] bg-white hover:bg-[#F8FAFC]",
                      ].join(" ")}
                    >
                      <div
                        className={[
                          "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                          selected
                            ? "border-[#2563EB] bg-[#2563EB]"
                            : "border-[#CBD5E1] bg-white",
                        ].join(" ")}
                      >
                        {selected && <Check size={11} strokeWidth={3} className="text-white" />}
                      </div>
                      <span
                        className={[
                          "text-sm font-medium",
                          selected ? "text-[#1D4ED8]" : "text-[#1E293B]",
                        ].join(" ")}
                      >
                        {album.name}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* 버튼 */}
        <div className="flex justify-end gap-2 border-t border-[#F1F5F9] px-6 py-3">
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
            disabled={selectedIds.length === 0}
            className="rounded-xl bg-[#2563EB] px-5 py-2 text-sm font-medium text-white hover:bg-[#1D4ED8] disabled:opacity-40 disabled:pointer-events-none"
          >
            공유하기
          </button>
        </div>
      </div>
    </div>
  );
}
