// 공유 앨범 만들기 모달 컴포넌트
import { useState } from "react";
import { X, FolderPlus, Users, Search } from "lucide-react";
import { searchUser } from "../../../api/user";
import type { SearchedUser } from "../../../api/user";

type Friend = {
  id: number;
  name: string;
  code: string;
  avatarColor: string;
  profileImageUrl?: string | null;
};

const AVATAR_COLORS = ["#8B5CF6", "#3B82F6", "#EC4899", "#F59E0B", "#10B981", "#EF4444"];

function getAvatarColor(userId: number): string {
  return AVATAR_COLORS[userId % AVATAR_COLORS.length];
}

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
  const [codeInput, setCodeInput] = useState("");
  const [searchResult, setSearchResult] = useState<SearchedUser | null>(null);
  const [searchError, setSearchError] = useState("");
  const [selected, setSelected] = useState<Friend[]>([]);

  if (!isOpen) return null;

  // GET /api/users/search — 개인 코드로 사용자 검색
  const handleSearch = async () => {
    const code = codeInput.trim();
    if (!code) return;
    setSearchError("");
    setSearchResult(null);
    try {
      const user = await searchUser(code);
      setSearchResult(user);
    } catch {
      setSearchError("해당 코드의 사용자를 찾을 수 없습니다.");
    }
  };

  const handleAdd = () => {
    if (!searchResult) return;
    if (selected.some((f) => f.id === searchResult.userId)) return;
    setSelected((prev) => [
      ...prev,
      {
        id: searchResult.userId,
        name: searchResult.nickname,
        code: searchResult.userCode,
        avatarColor: getAvatarColor(searchResult.userId),
        profileImageUrl: searchResult.profileImageUrl,
      },
    ]);
    setSearchResult(null);
    setCodeInput("");
  };

  const handleRemove = (id: number) => {
    setSelected((prev) => prev.filter((f) => f.id !== id));
  };

  const handleClose = () => {
    setCodeInput("");
    setSearchResult(null);
    setSearchError("");
    setSelected([]);
    onClose();
  };

  const handleConfirm = () => {
    if (selected.length === 0) return;
    onConfirm?.(selected);
    handleClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
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
              <p className="text-xs text-[#94A3B8]">개인 코드로 친구를 추가하세요</p>
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

        {/* 코드 검색 입력 */}
        <div className="px-6 pb-3">
          <div className="flex gap-2">
            <input
              type="text"
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="개인 코드 입력 (예: ABC12345)"
              className="flex-1 rounded-xl border border-[#E2E8F0] px-3 py-2 text-sm outline-none focus:border-[#2563EB]"
            />
            <button
              type="button"
              onClick={handleSearch}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#EEF4FF] text-[#2563EB] transition-colors hover:bg-[#DBEAFE]"
            >
              <Search size={16} />
            </button>
          </div>

          {/* 검색 결과 */}
          {searchResult && (
            <div className="mt-2 flex items-center gap-3 rounded-xl border border-[#E2E8F0] px-4 py-3">
              {searchResult.profileImageUrl ? (
                <img
                  src={searchResult.profileImageUrl}
                  alt={searchResult.nickname}
                  className="h-9 w-9 shrink-0 rounded-full object-cover"
                />
              ) : (
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                  style={{ backgroundColor: getAvatarColor(searchResult.userId) }}
                >
                  {searchResult.nickname[0]}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[#1E293B]">{searchResult.nickname}</p>
                <p className="truncate text-xs text-[#94A3B8]"># {searchResult.userCode}</p>
              </div>
              <button
                type="button"
                onClick={handleAdd}
                disabled={selected.some((f) => f.id === searchResult.userId)}
                className="rounded-lg bg-[#2563EB] px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-[#1D4ED8] disabled:opacity-40 disabled:pointer-events-none"
              >
                추가
              </button>
            </div>
          )}

          {/* 오류 메시지 */}
          {searchError && (
            <p className="mt-2 text-xs text-red-500">{searchError}</p>
          )}
        </div>

        {/* 추가된 친구 목록 */}
        {selected.length > 0 && (
          <div className="px-6 pb-2">
            <p className="mb-2 text-xs font-semibold text-[#64748B]">추가된 친구</p>
            <div className="max-h-45 overflow-y-auto rounded-xl border border-[#F1F5F9]">
              {selected.map((friend, idx) => (
                <div
                  key={friend.id}
                  className={[
                    "flex items-center gap-3 px-4 py-3",
                    idx !== selected.length - 1 ? "border-b border-[#F1F5F9]" : "",
                  ].join(" ")}
                >
                  {friend.profileImageUrl ? (
                    <img
                      src={friend.profileImageUrl}
                      alt={friend.name}
                      className="h-9 w-9 shrink-0 rounded-full object-cover"
                    />
                  ) : (
                    <div
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                      style={{ backgroundColor: friend.avatarColor }}
                    >
                      {friend.name[0]}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[#1E293B]">{friend.name}</p>
                    <p className="truncate text-xs text-[#94A3B8]"># {friend.code}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemove(friend.id)}
                    className="flex h-6 w-6 items-center justify-center rounded-full text-[#94A3B8] hover:bg-[#F1F5F9] hover:text-[#475569]"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 선택 상태 안내 */}
        <div className="flex items-center gap-2 px-6 py-3">
          <Users size={14} className="text-[#F59E0B]" />
          <span className="text-xs font-medium text-[#F59E0B]">{selected.length}명 추가됨</span>
          {selected.length === 0 && (
            <span className="text-xs text-[#F59E0B]">· 1명 이상 추가하세요</span>
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
