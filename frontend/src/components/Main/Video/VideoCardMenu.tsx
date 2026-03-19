// 영상 카드의 더보기 메뉴를 렌더링하는 컴포넌트 파일
import { Pencil, Share2, Trash2 } from "lucide-react";

type VideoCardMenuProps = {
  onEdit: () => void;
  onShare: () => void;
  onDelete: () => void;
};

export default function VideoCardMenu({ onEdit, onShare, onDelete }: VideoCardMenuProps) {
  return (
    <div className="absolute right-0 top-9 z-50 w-[148px] rounded-xl border border-[#E5E7EB] bg-white p-1.5 shadow-lg">
      <button
        type="button"
        onClick={onEdit}
        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-[#111827] transition-colors hover:bg-[#F3F4F6]"
      >
        <Pencil size={15} strokeWidth={2} />
        <span>편집</span>
      </button>
      <button
        type="button"
        onClick={onShare}
        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-[#111827] transition-colors hover:bg-[#F3F4F6]"
      >
        <Share2 size={15} strokeWidth={2} />
        <span>공유</span>
      </button>
      <button
        type="button"
        onClick={onDelete}
        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-[#DC2626] transition-colors hover:bg-[#FEF2F2]"
      >
        <Trash2 size={15} strokeWidth={2} />
        <span>삭제</span>
      </button>
    </div>
  );
}
