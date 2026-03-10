// 친구 찾기 모달 컴포넌트
import { useState } from "react";
import { Search, X, UserPlus } from "lucide-react";

type FriendSearchModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

// 8자리 영문+숫자 코드 판별
const isCode = (value: string) => /^[A-Za-z0-9]{1,8}$/.test(value.trim()) && !value.includes("@");
const isEmail = (value: string) => value.includes("@");

function detectType(value: string): "email" | "code" | null {
  if (!value.trim()) return null;
  if (isEmail(value)) return "email";
  if (isCode(value)) return "code";
  return null;
}

export default function FriendSearchModal({
  isOpen,
  onClose,
}: FriendSearchModalProps) {
  const [inputValue, setInputValue] = useState("");
  const [searchResult, setSearchResult] = useState<{
    name: string;
    email: string;
    code: string;
  } | null>(null);
  const [searched, setSearched] = useState(false);

  if (!isOpen) return null;

  const detectedType = detectType(inputValue);

  const handleSearch = () => {
    if (!inputValue.trim() || !detectedType) return;
    // TODO: 실제 API 호출로 교체
    setSearched(true);
    // mock 결과
    if (
      inputValue.trim().toUpperCase() === "AB12CD34" ||
      inputValue.includes("@")
    ) {
      setSearchResult({
        name: "김민수",
        email: "minsu@example.com",
        code: "AB12CD34",
      });
    } else {
      setSearchResult(null);
    }
  };

  const handleClose = () => {
    setInputValue("");
    setSearchResult(null);
    setSearched(false);
    onClose();
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
              <Search size={18} className="text-[#2563EB]" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#1E293B]">친구 찾기</h2>
              <p className="text-xs text-[#94A3B8]">
                이메일 또는 개인 코드로 검색하세요
              </p>
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

        <div className="px-6 pb-4">
          {/* 입력 */}
          <div className="relative flex items-center">
            <Search
              size={15}
              className="absolute left-3 text-[#94A3B8]"
            />
            <input
              type="text"
              placeholder="이메일 또는 코드 입력"
              value={inputValue}
              onChange={(e) => {
                setInputValue(e.target.value);
                setSearched(false);
                setSearchResult(null);
              }}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="h-10 w-full rounded-xl border border-[#E2E8F0] pl-9 pr-10 text-sm text-[#1E293B] outline-none placeholder:text-[#CBD5E1] focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/10"
            />
            <button
              type="button"
              onClick={handleSearch}
              disabled={!detectedType}
              className="absolute right-2 flex h-6 w-6 items-center justify-center rounded-lg text-[#94A3B8] transition-colors hover:text-[#2563EB] disabled:pointer-events-none disabled:opacity-40"
            >
              <Search size={14} />
            </button>
          </div>

          {/* 타입 힌트 */}
          {!searched && (
            <div className="mt-3 flex items-center justify-center gap-1.5 text-xs text-[#94A3B8]">
              <span
                className={
                  detectedType === "email"
                    ? "font-semibold text-[#2563EB]"
                    : ""
                }
              >
                이메일
              </span>
              <span>또는</span>
              <span
                className={
                  detectedType === "code"
                    ? "font-semibold text-[#2563EB]"
                    : ""
                }
              >
                8자리 코드
              </span>
            </div>
          )}

          {/* 안내 문구 */}
          {!searched && (
            <p className="mt-1 text-center text-xs text-[#CBD5E1]">
              프로필의 개인 코드를 공유하여 친구를 찾아보세요
            </p>
          )}

          {/* 검색 결과 */}
          {searched && (
            <div className="mt-3">
              {searchResult ? (
                <div className="flex items-center justify-between rounded-xl border border-[#E8EDF4] bg-[#F8FBFF] px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#DBEAFE] text-sm font-bold text-[#2563EB]">
                      {searchResult.name[0]}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-[#1E293B]">
                        {searchResult.name}
                      </p>
                      <p className="text-xs text-[#94A3B8]">
                        {searchResult.email}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => console.log("친구 추가:", searchResult)}
                    className="flex items-center gap-1.5 rounded-lg bg-[#2563EB] px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[#1D4ED8]"
                  >
                    <UserPlus size={13} />
                    추가
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-center rounded-xl bg-[#F8FAFC] py-5 text-sm text-[#94A3B8]">
                  검색 결과가 없습니다.
                </div>
              )}
            </div>
          )}
        </div>

        {/* 푸터 */}
        <div className="flex justify-end border-t border-[#F1F5F9] px-6 py-3">
          <button
            type="button"
            onClick={handleClose}
            className="rounded-xl bg-[#F1F5F9] px-5 py-2 text-sm font-medium text-[#475569] transition-colors hover:bg-[#E2E8F0]"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
