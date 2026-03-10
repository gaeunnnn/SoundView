// 영상 플레이어 하단의 이모지 반응 버튼 바 컴포넌트 파일
import type { EmojiReaction } from "../../types/viewer";

type EmojiReactionBarProps = {
  reactions: EmojiReaction[];
  onReact: (emoji: string) => void;
};

export default function EmojiReactionBar({ reactions, onReact }: EmojiReactionBarProps) {
  return (
    <div className="shrink-0 border-t border-[#1E293B] bg-[#0F172A] px-5 py-3">
      <div className="flex items-center gap-2">
        {reactions.map((r) => (
          <button
            key={r.emoji}
            type="button"
            onClick={() => onReact(r.emoji)}
            className={[
              "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition-all",
              r.reacted
                ? "bg-[#1E3A5F] ring-1 ring-[#2563EB]"
                : "bg-[#1E293B] hover:bg-[#253347] text-white",
            ].join(" ")}
          >
            <span className="text-base leading-none">{r.emoji}</span>
            {r.count > 0 && (
              <span className={["text-xs font-semibold", r.reacted ? "text-[#60A5FA]" : "text-[#94A3B8]"].join(" ")}>
                {r.count}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
