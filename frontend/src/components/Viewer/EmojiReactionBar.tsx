// 영상 플레이어 하단의 이모지 반응 버튼 바 컴포넌트 파일
import type { EmojiReaction } from "../../types/viewer";

type EmojiReactionBarProps = {
  reactions: EmojiReaction[];
  onReact: (emoji: string) => void;
  variant?: "dark" | "light";
};

export default function EmojiReactionBar({ reactions, onReact, variant = "dark" }: EmojiReactionBarProps) {
  return (
    <div className={variant === "dark" ? "shrink-0 border-t border-[#1E293B] bg-[#0F172A] px-5 py-3" : "flex items-center gap-2 flex-wrap"}>
      <div className={variant === "dark" ? "flex items-center gap-2" : "flex items-center gap-2 flex-wrap"}>
        {reactions.map((r) => (
          <button
            key={r.emoji}
            type="button"
            onClick={() => onReact(r.emoji)}
            className={[
              "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition-all",
              variant === "dark"
                ? r.reacted
                  ? "bg-[#1E3A5F] ring-1 ring-[#2563EB]"
                  : "bg-[#1E293B] hover:bg-[#253347] text-white"
                : r.reacted
                  ? "bg-[#DBEAFE] ring-1 ring-[#2563EB] text-[#2563EB]"
                  : "bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#334155]",
            ].join(" ")}
          >
            <span className="text-base leading-none">{r.emoji}</span>
            {r.count > 0 && (
              <span className={["text-xs font-semibold", r.reacted ? (variant === "dark" ? "text-[#60A5FA]" : "text-[#2563EB]") : (variant === "dark" ? "text-[#94A3B8]" : "text-[#64748B]")].join(" ")}>
                {r.count}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
