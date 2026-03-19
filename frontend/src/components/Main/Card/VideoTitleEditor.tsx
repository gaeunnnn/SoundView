// 영상 카드 공통 제목 인라인 편집 컴포넌트 (내 앨범 / 공유앨범 공용)
import { useEffect, useRef, useState } from "react";
import { Pencil } from "lucide-react";

type VideoTitleEditorProps = {
  title: string;
  onCommit: (newTitle: string) => void;
  accentColor?: string;
  dark?: boolean;
};

export default function VideoTitleEditor({
  title,
  onCommit,
  accentColor = "#2563EB",
  dark = false,
}: VideoTitleEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(title);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setEditTitle(title);
  }, [title]);

  useEffect(() => {
    if (isEditing) inputRef.current?.focus();
  }, [isEditing]);

  const handleCommit = () => {
    const trimmed = editTitle.trim();
    if (trimmed && trimmed !== title) {
      onCommit(trimmed);
    } else {
      setEditTitle(title);
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") handleCommit();
    if (e.key === "Escape") { setEditTitle(title); setIsEditing(false); }
  };

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        value={editTitle}
        onChange={(e) => setEditTitle(e.target.value)}
        onBlur={handleCommit}
        onKeyDown={handleKeyDown}
        className="w-full rounded-lg border px-2 py-0.5 text-sm font-bold text-[#111827] outline-none ring-2"
        style={{
          borderColor: accentColor,
        }}
      />
    );
  }

  return (
    <>
      {!dark && <h3 className="truncate text-sm font-bold text-[#111827]">{title}</h3>}
      <button
        type="button"
        onClick={() => { setEditTitle(title); setIsEditing(true); }}
        className={[
          "shrink-0 transition-colors",
          dark
            ? "text-white/50 hover:text-white"
            : "text-[#94A3B8] hover:text-[#64748B]",
        ].join(" ")}
        aria-label={`${title} 제목 수정`}
      >
        <Pencil size={12} strokeWidth={2} />
      </button>
    </>
  );
}
