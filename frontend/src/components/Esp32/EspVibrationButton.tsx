// ESP32 진동 연결 토글 버튼
import { Vibrate } from "lucide-react";
import { useEsp } from "../../context/EspContext";

export default function EspVibrationButton() {
  const { status, toggle } = useEsp();

  const isConnected = status === "connected";
  const isConnecting = status === "connecting";
  const isError = status === "error";
  const isActive = isConnected || isConnecting;

  const label = isConnected ? "진동 연결됨"
    : isConnecting ? "연결 중..."
    : isError ? "연결 실패 (재시도)"
    : "진동 연결";

  return (
    <button
      type="button"
      onClick={toggle}
      title={label}
      className={[
        "flex items-center gap-2 rounded-full px-3 py-2.5 sm:px-5 text-sm font-semibold shadow-sm transition-all",
        isActive
          ? "bg-[#7C3AED] text-white hover:bg-[#6D28D9] hover:shadow-md"
          : isError
          ? "bg-white border border-[#FCA5A5] text-[#EF4444] hover:bg-[#FEF2F2]"
          : "bg-white border border-[#E2E8F0] text-[#64748B] hover:bg-[#F8FAFC] hover:border-[#CBD5E1]",
      ].join(" ")}
    >
      {isConnecting ? (
        <span className="flex gap-0.5 items-center">
          <span className="h-1.5 w-1.5 rounded-full bg-white animate-bounce [animation-delay:0ms]" />
          <span className="h-1.5 w-1.5 rounded-full bg-white animate-bounce [animation-delay:150ms]" />
          <span className="h-1.5 w-1.5 rounded-full bg-white animate-bounce [animation-delay:300ms]" />
        </span>
      ) : (
        <Vibrate
          size={15}
          strokeWidth={2.5}
          className={isConnected ? "text-white" : isError ? "text-[#EF4444]" : "text-[#94A3B8]"}
        />
      )}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}
