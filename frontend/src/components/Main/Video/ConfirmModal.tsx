// 삭제 확인 모달을 렌더링하는 컴포넌트 파일
import { AlertTriangle } from "lucide-react";

type ConfirmModalProps = {
  open: boolean;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  onClose: () => void;
  onConfirm: () => void;
};

export default function ConfirmModal({
  open,
  title,
  description,
  confirmText = "삭제",
  cancelText = "취소",
  onClose,
  onConfirm,
}: ConfirmModalProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-[420px] rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-[#FEF2F2] text-[#DC2626]">
          <AlertTriangle size={22} strokeWidth={2} />
        </div>

        <h3 className="text-lg font-bold text-[#111827]">{title}</h3>
        <p className="mt-2 text-sm leading-6 text-[#6B7280]">{description}</p>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-[#E5E7EB] px-4 py-2 text-sm font-semibold text-[#374151] transition-colors hover:bg-[#F9FAFB]"
          >
            {cancelText}
          </button>

          <button
            type="button"
            onClick={onConfirm}
            className="rounded-xl bg-[#DC2626] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#B91C1C]"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}