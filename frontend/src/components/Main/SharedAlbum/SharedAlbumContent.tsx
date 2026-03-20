// 공유 앨범 콘텐츠 영역 컴포넌트
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Search, SlidersHorizontal, Users, Upload, Copy, Check } from "lucide-react";
import type { SharedAlbumDetail, SharedVideoItem } from "../../../types/sharedAlbum";
import type { VideoItem } from "../../../types/video";
import SharedVideoCard from "./SharedVideoCard";
import ImportVideoModal from "./ImportVideoModal";
import { getMyAlbumVideos, addVideosToAlbum } from "../../../api/album";
import { addVideoReaction, deleteVideoReaction, updateVideoTitle, deleteVideo } from "../../../api/video";
import { useUser } from "../../../context/UserContext";

type Tab = "all" | "mine";

type SharedAlbumContentProps = {
  album: SharedAlbumDetail;
  myAlbumId: number | null;
};

export default function SharedAlbumContent({ album, myAlbumId }: SharedAlbumContentProps) {
  const { me } = useUser();
  const [videos, setVideos] = useState<SharedVideoItem[]>(album.videos);
  const [myVideos, setMyVideos] = useState<VideoItem[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>("all");
  const [searchKeyword, setSearchKeyword] = useState("");
  const [showParticipants, setShowParticipants] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const participantRef = useRef<HTMLDivElement>(null);
  const participantBtnRef = useRef<HTMLButtonElement>(null);
  const [participantPos, setParticipantPos] = useState<{ top: number; left: number } | null>(null);

  // album이 바뀌면 videos 초기화
  useEffect(() => {
    setVideos(album.videos);
    setActiveTab("all");
    setSearchKeyword("");
  }, [album.id]);

  // 참여자 팝오버 외부 클릭 닫기
  useEffect(() => {
    if (!showParticipants) return;
    const handle = (e: MouseEvent) => {
      if (
        participantRef.current &&
        !participantRef.current.contains(e.target as Node)
      ) {
        setShowParticipants(false);
      }
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [showParticipants]);

  const handleReact = (videoId: number, emoji: string) => {
    setVideos((prev) =>
      prev.map((v) => {
        if (v.id !== videoId) return v;
        const existing = v.reactions.find((r) => r.emoji === emoji);
        if (existing) {
          if (existing.reacted) {
            deleteVideoReaction(videoId, emoji).catch(() => {});
          } else {
            addVideoReaction(videoId, emoji).catch(() => {});
          }
          return {
            ...v,
            reactions: v.reactions.map((r) =>
              r.emoji === emoji
                ? {
                    ...r,
                    reacted: !r.reacted,
                    count: r.reacted ? r.count - 1 : r.count + 1,
                  }
                : r
            ),
          };
        }
        // 새 이모지 추가
        addVideoReaction(videoId, emoji).catch(() => {});
        return {
          ...v,
          reactions: [
            ...v.reactions,
            { emoji, count: 1, reacted: true },
          ],
        };
      })
    );
  };

  const meParticipant = album.participants.find((p) => p.code === me?.userCode);

  const handleRenameVideo = (videoId: number, newTitle: string) => {
    updateVideoTitle(videoId, newTitle).catch(() => {});
    setVideos((prev) =>
      prev.map((v) => (v.id === videoId ? { ...v, title: newTitle } : v))
    );
  };

  const handleDeleteVideo = async (videoId: number) => {
    await deleteVideo(videoId).catch(() => {});
    setVideos((prev) => prev.filter((v) => v.id !== videoId));
  };

  const handleImport = async (selected: VideoItem[]) => {
    const videoIds = selected.map((v) => v.id);
    await addVideosToAlbum(album.id, videoIds).catch(() => {});
    const newSharedVideos: SharedVideoItem[] = selected.map((v) => ({
      ...v,
      uploadedBy: meParticipant ?? { id: 0, name: "나", avatarColor: "#8B5CF6", isMe: true },
      reactions: [],
      commentCount: 0,
    }));
    setVideos((prev) => [...prev, ...newSharedVideos]);
  };

  const filtered = videos.filter((v) => {
    const matchesTab =
      activeTab === "all" || (activeTab === "mine" && v.uploadedBy.isMe);
    const normalizedKeyword = searchKeyword.replace(/\s/g, "").toLowerCase();
    const matchesSearch = !normalizedKeyword ||
      v.title.replace(/\s/g, "").toLowerCase().includes(normalizedKeyword);
    return matchesTab && matchesSearch;
  });

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
    <section className="bg-white/80 backdrop-blur-sm px-4 pt-5 pb-4 sm:px-6 sm:pt-6 sm:pb-5 lg:px-8 lg:pt-8 border-b border-[#E8EDF4]">
      <div className="mx-auto max-w-[1280px] space-y-6">
        {/* 헤더 */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[#0F172A]">{album.name}</h1>
            <div className="mt-1.5 flex items-center gap-2">
              <span className="inline-flex items-center rounded-full bg-[#ECFDF5] px-2.5 py-0.5 text-xs font-semibold text-[#059669]">
                {videos.length}개의 영상
              </span>

              {/* 참여자 배지 */}
              <div ref={participantRef} className="relative">
                <button
                  ref={participantBtnRef}
                  type="button"
                  onClick={() => {
                    if (!showParticipants && participantBtnRef.current) {
                      const r = participantBtnRef.current.getBoundingClientRect();
                      setParticipantPos({ top: r.bottom + 6, left: r.left });
                    }
                    setShowParticipants((p) => !p);
                  }}
                  className="flex items-center gap-1.5 rounded-full bg-[#F1F5F9] px-2.5 py-0.5 text-xs font-medium text-[#64748B] transition-colors hover:bg-[#E2E8F0]"
                >
                  <Users size={11} />
                  {album.participants.length}명
                </button>

                {showParticipants && participantPos && createPortal(
                  <div
                    ref={participantRef}
                    className="fixed z-[9999] w-64 rounded-2xl border border-[#E8EDF4] bg-white p-4 shadow-lg sm:w-72"
                    style={{ top: participantPos.top, left: participantPos.left }}
                  >
                    <p className="mb-3 text-xs font-semibold text-[#94A3B8]">
                      참여자 {album.participants.length}명
                    </p>
                    <ul className="space-y-2 max-h-[168px] overflow-y-auto">
                      {[...album.participants]
                        .sort((a, b) => {
                          const aIsMe = a.code === me?.userCode;
                          const bIsMe = b.code === me?.userCode;
                          if (aIsMe) return -1;
                          if (bIsMe) return 1;
                          return a.name.localeCompare(b.name, "ko");
                        })
                        .map((p) => {
                          const isMe = p.code === me?.userCode;
                          return (
                        <li key={p.id} className="flex items-center gap-2.5 overflow-hidden">
                          {p.profileImageUrl ? (
                            <img
                              src={p.profileImageUrl}
                              alt={p.name}
                              className="h-8 w-8 shrink-0 rounded-full object-cover"
                            />
                          ) : (
                            <div
                              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                              style={{ backgroundColor: p.avatarColor }}
                            >
                              {p.name[0]}
                            </div>
                          )}
                          <span className="truncate text-sm font-medium text-[#1E293B]">
                            {p.name}
                          </span>
                          {isMe ? (
                            <span className="ml-auto shrink-0 rounded-full bg-[#EEF4FF] px-2 py-0.5 text-[10px] font-semibold text-[#2563EB]">
                              나
                            </span>
                          ) : p.code ? (
                            <div className="ml-auto flex shrink-0 items-center gap-1">
                              <span className="whitespace-nowrap text-[11px] font-semibold text-[#2563EB]">
                                # {p.code}
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  navigator.clipboard.writeText(p.code!);
                                  setCopiedId(p.id);
                                  setTimeout(() => setCopiedId(null), 1500);
                                }}
                                className="text-[#CBD5E1] transition-colors hover:text-[#2563EB]"
                                title="코드 복사"
                              >
                                {copiedId === p.id ? (
                                  <Check size={12} className="text-[#10B981]" />
                                ) : (
                                  <Copy size={12} />
                                )}
                              </button>
                            </div>
                          ) : null}
                        </li>
                          );
                        })}
                    </ul>
                  </div>,
                  document.body
                )}
              </div>
            </div>
          </div>

          {/* 가져오기 버튼 */}
          <button
            type="button"
            onClick={() => {
              if (!myAlbumId || myAlbumId <= 0 || !Number.isFinite(myAlbumId)) { setShowImport(true); return; }
              getMyAlbumVideos(myAlbumId).then((data) => {
                setMyVideos(data.map((v) => ({
                  id: v.videoId,
                  title: v.title,
                  thumbnail: v.thumbnailUrl ?? "",
                  duration: v.durationSec != null ? `${Math.floor(v.durationSec / 60)}:${String(v.durationSec % 60).padStart(2, "0")}` : "",
                  date: v.createdAt.slice(0, 10).replace(/-/g, "."),
                  uploaderName: "",
                })));
              }).catch(() => {});
              setShowImport(true);
            }}
            className="flex items-center gap-2 rounded-full bg-gradient-to-r from-[#10B981] to-[#059669] px-3 py-2.5 sm:px-5 text-sm font-semibold text-white shadow-sm transition-all hover:shadow-md hover:opacity-90"
          >
            <Upload size={15} strokeWidth={2.5} />
            <span className="hidden sm:inline">가져오기</span>
          </button>
        </div>

        {/* 탭 + 검색/정렬 */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-1 rounded-xl bg-[#F1F5F9] p-1 self-start">
            <button
              type="button"
              onClick={() => setActiveTab("all")}
              className={[
                "rounded-lg px-4 py-1.5 text-sm font-medium transition-all",
                activeTab === "all"
                  ? "bg-white text-[#111827] shadow-sm"
                  : "text-[#64748B] hover:text-[#334155]",
              ].join(" ")}
            >
              전체 영상
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("mine")}
              className={[
                "rounded-lg px-4 py-1.5 text-sm font-medium transition-all",
                activeTab === "mine"
                  ? "bg-white text-[#111827] shadow-sm"
                  : "text-[#64748B] hover:text-[#334155]",
              ].join(" ")}
            >
              내가 만든 영상
            </button>
          </div>

          <div className="flex items-center gap-2">
            {/* 검색 */}
            <div className="relative flex-1 sm:flex-none">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]"
              />
              <input
                type="text"
                placeholder="영상 검색"
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                className="h-9 w-full sm:w-44 rounded-xl border border-[#E2E8F0] bg-white pl-8 pr-3 text-sm outline-none placeholder:text-[#CBD5E1] focus:border-[#6366F1] focus:ring-2 focus:ring-[#6366F1]/10 shadow-sm"
              />
            </div>
            {/* 정렬 */}
            <button
              type="button"
              className="flex h-9 items-center gap-1.5 rounded-xl border border-[#E2E8F0] bg-white px-3 text-sm text-[#475569] shadow-sm transition-colors hover:bg-[#F0F4FF] hover:border-[#C7D7FD] hover:text-[#2563EB]"
            >
              <SlidersHorizontal size={14} />
              최신순
            </button>
          </div>
        </div>

      </div>
    </section>

    {/* 영상 그리드 — 흰 배경으로 나머지 전체 채움 */}
    <div className="flex-1 overflow-y-auto bg-[#F4F7FF]">
      <div className="mx-auto max-w-[1280px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        {filtered.length > 0 ? (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((video) => (
              <SharedVideoCard
                key={video.id}
                video={video}
                onReact={handleReact}
                onRenameTitle={handleRenameVideo}
                onDelete={handleDeleteVideo}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-[#94A3B8]">
            <p className="text-sm">영상이 없습니다.</p>
          </div>
        )}
      </div>
    </div>

    <ImportVideoModal
      isOpen={showImport}
      myVideos={myVideos}
      onClose={() => setShowImport(false)}
      onConfirm={handleImport}
    />
    </div>
  );
}
