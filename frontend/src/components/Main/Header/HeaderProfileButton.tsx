// 상단 헤더 우측의 사용자 프로필 버튼과 드롭다운을 렌더링하는 컴포넌트 파일
import { useEffect, useRef, useState } from "react";
import { ChevronDown, Copy, Settings, LogOut, Check } from "lucide-react";

type HeaderProfileButtonProps = {
  userName: string;
  userCode?: string;
  onClick?: () => void;
};

export default function HeaderProfileButton({
  userName,
  userCode = "MJ2026",
}: HeaderProfileButtonProps) {
  const initial = userName.slice(0, 1);
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [isOpen]);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(userCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center gap-3 rounded-xl px-2 py-1.5 transition-colors hover:bg-[#F8FAFC]"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#8B5CF6] text-sm font-semibold text-white">
          {initial}
        </span>
        <span className="text-sm font-semibold text-[#111827]">{userName}</span>
        <ChevronDown
          size={16}
          strokeWidth={2}
          className={["text-[#94A3B8] transition-transform", isOpen ? "rotate-180" : ""].join(" ")}
        />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-12 z-50 w-56 rounded-2xl border border-[#E8EDF4] bg-white py-2 shadow-xl">
          {/* 프로필 정보 */}
          <div className="px-4 py-3">
            <p className="text-sm font-bold text-[#1E293B]">{userName}</p>

            {/* 개인 코드 */}
            <div className="mt-2 flex items-center justify-between rounded-lg bg-[#F8FAFC] px-2.5 py-1.5">
              <span className="text-xs font-semibold text-[#2563EB]">
                # {userCode}
              </span>
              <button
                type="button"
                onClick={handleCopyCode}
                className="text-[#94A3B8] transition-colors hover:text-[#2563EB]"
                title="코드 복사"
              >
                {copied ? (
                  <Check size={13} className="text-[#10B981]" />
                ) : (
                  <Copy size={13} />
                )}
              </button>
            </div>
          </div>

          <div className="my-1 border-t border-[#F1F5F9]" />

          {/* 설정 / 로그아웃 */}
          <div className="px-2">
            <button
              type="button"
              onClick={() => { setIsOpen(false); console.log("설정 클릭"); }}
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-[#334155] transition-colors hover:bg-[#F8FAFC]"
            >
              <Settings size={15} className="text-[#64748B]" />
              설정
            </button>
            <button
              type="button"
              onClick={() => { setIsOpen(false); console.log("로그아웃 클릭"); }}
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-[#EF4444] transition-colors hover:bg-[#FFF5F5]"
            >
              <LogOut size={15} className="text-[#EF4444]" />
              로그아웃
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
