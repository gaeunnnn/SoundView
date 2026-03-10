// 공유 앨범 만들기 모달 컴포넌트
import { useState } from "react";
import { X, FolderPlus, Users } from "lucide-react";

type Friend = {
  id: number;
  name: string;
  email: string;
  avatarColor: string;
};

// 더미 친구 목록 (추후 API 연동)
const DUMMY_FRIENDS: Friend[] = [
  { id: 1, name: "김지은", email: "jieun@example.com", avatarColor: "#8B5CF6" },
  { id: 2, name: "박준호", email: "junho@example.com", avatarColor: "#3B82F6" },
  { id: 3, name: "이서연", email: "seoyeon@example.com", avatarColor: "#EC4899" },
  { id: 4, name: "최윤서", email: "yoonseo@example.com", avatarColor: "#F59E0B" },
];

type CreateSharedAlbumModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onConfirm?: (selectedFriends: Friend[]) => void;
};

export default function CreateSharedAlbumModal({
  isOpen,
  onClose,
  onConfirm,
}: CreateSharedAlbumModalProps) {
  const [selected, setSelected] = useState<number[]>([]);

  if (!isOpen) return null;

  const toggleFriend = (id: number) => {
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
    onConfirm?.(DUMMY_FRIENDS.filter((f) => selected.includes(f.id)));
    handleClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={handleClose}
    >
      <div
        className="relative w-full max-w-sm rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-start justify-between px-6 pt-6 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EEF4FF]">
              <FolderPlus size={18} className="text-[#2563EB]" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#1E293B]">앨범 만들기</h2>
              <p className="text-xs text-[#94A3B8]">함께할 친구를 선택하세요</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="flex h-7 w-7 items-center justify-center rounded-full text-[#94A3B8] transition-colors hover:bg-[#F1F5F9] hover:text-[#475569]"
          >
            <X size={16} />
          </button>
        </div>

        {/* 친구 목록 */}
        <div className="px-6 pb-2">
          <p className="mb-2 text-xs font-semibold text-[#64748B]">친구 목록</p>
          <div className="max-h-[260px] overflow-y-auto rounded-xl border border-[#F1F5F9]">
            {DUMMY_FRIENDS.map((friend, idx) => {
              const isChecked = selected.includes(friend.id);
              return (
                <button
                  key={friend.id}
                  type="button"
                  onClick={() => toggleFriend(friend.id)}
                  className={[
                    "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[#F8FAFC]",
                    idx !== DUMMY_FRIENDS.length - 1
                      ? "border-b border-[#F1F5F9]"
                      : "",
                  ].join(" ")}
                >
                  {/* 아바타 */}
                  <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                    style={{ backgroundColor: friend.avatarColor }}
                  >
                    {friend.name[0]}
                  </div>
                  {/* 이름/이메일 */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[#1E293B]">
                      {friend.name}
                    </p>
                    <p className="truncate text-xs text-[#94A3B8]">
                      {friend.email}
                    </p>
                  </div>
                  {/* 체크박스 */}
                  <div
                    className={[
                      "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-colors",
                      isChecked
                        ? "border-[#2563EB] bg-[#2563EB]"
                        : "border-[#CBD5E1] bg-white",
                    ].join(" ")}
                  >
                    {isChecked && (
                      <svg
                        width="10"
                        height="8"
                        viewBox="0 0 10 8"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          d="M1 3.5L3.5 6.5L9 1"
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
        </div>

        {/* 선택 상태 안내 */}
        <div className="flex items-center gap-2 px-6 py-3">
          <Users size={14} className="text-[#F59E0B]" />
          <span className="text-xs font-medium text-[#F59E0B]">
            {selected.length}명 선택
          </span>
          {selected.length === 0 && (
            <span className="text-xs text-[#F59E0B]">· 1명 이상 선택하세요</span>
          )}
        </div>

        {/* 푸터 */}
        <div className="flex justify-end gap-2 border-t border-[#F1F5F9] px-6 py-3">
          <button
            type="button"
            onClick={handleClose}
            className="rounded-xl bg-[#F1F5F9] px-5 py-2 text-sm font-medium text-[#475569] transition-colors hover:bg-[#E2E8F0]"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={selected.length === 0}
            className="rounded-xl bg-[#2563EB] px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-[#1D4ED8] disabled:opacity-40 disabled:pointer-events-none"
          >
            만들기
          </button>
        </div>
      </div>
    </div>
  );
}
