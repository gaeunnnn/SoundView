// 공유 앨범 이름 수정 모달
import { useEffect, useRef, useState } from "react";
import { X, Pencil } from "lucide-react";

type RenameSharedAlbumModalProps = {
  isOpen: boolean;
  currentName: string;
  onClose: () => void;
  onConfirm: (newName: string) => void;
};

export default function RenameSharedAlbumModal({
  isOpen,
  currentName,
  onClose,
  onConfirm,
}: RenameSharedAlbumModalProps) {
  const [name, setName] = useState(currentName);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setName(currentName);
      setTimeout(() => inputRef.current?.select(), 0);
    }
  }, [isOpen, currentName]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onConfirm(trimmed);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between px-6 pt-6 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#ECFDF5]">
              <Pencil size={17} className="text-[#059669]" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#1E293B]">이름 수정</h2>
              <p className="text-xs text-[#94A3B8]">공유 앨범 이름을 변경하세요</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-full text-[#94A3B8] hover:bg-[#F1F5F9]"
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-6 pb-4">
          <input
            ref={inputRef}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleConfirm();
              if (e.key === "Escape") onClose();
            }}
            placeholder={currentName}
            className="h-10 w-full rounded-xl border border-[#E2E8F0] px-3 text-sm text-[#1E293B] outline-none placeholder:text-[#CBD5E1] focus:border-[#059669] focus:ring-2 focus:ring-[#059669]/10"
          />
        </div>

        <div className="flex justify-end gap-2 border-t border-[#F1F5F9] px-6 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-[#F1F5F9] px-5 py-2 text-sm font-medium text-[#475569] hover:bg-[#E2E8F0]"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!name.trim()}
            className="rounded-xl bg-[#059669] px-5 py-2 text-sm font-medium text-white hover:bg-[#047857] disabled:opacity-40 disabled:pointer-events-none"
          >
            수정
          </button>
        </div>
      </div>
    </div>
  );
}
