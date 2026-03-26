// 메인 페이지 전체 레이아웃을 조립하는 페이지 파일
import { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { getAlbums, editAlbumTitle, leaveAlbum, createAlbum, getAlbumMembers, getAlbumVideos } from "../api/album";
import { getVideoReactions } from "../api/video";
import { useUser } from "../context/UserContext";
import { useVideos } from "../context/VideosContext";
import MainHeader from "../components/Main/Header/MainHeader";
import MainSidebar from "../components/Main/Sidebar/MainSidebar";
import MainContent from "../components/Main/Video/MainContent";
import SharedAlbumContent from "../components/Main/SharedAlbum/SharedAlbumContent";
import CreateSharedAlbumModal from "../components/Main/Sidebar/CreateSharedAlbumModal";
import RenameSharedAlbumModal from "../components/Main/Sidebar/RenameSharedAlbumModal";
import ConfirmModal from "../components/Main/Video/ConfirmModal";
import type { SharedAlbumItem } from "../types/sidebar";
import type { SharedAlbumDetail } from "../types/sharedAlbum";
import { useUpload } from "../context/UploadContext";

const COLORS = ["#8B5CF6", "#3B82F6", "#EC4899", "#F59E0B", "#10B981", "#EF4444"];

export default function MainPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { me } = useUser();
  const { fetchVideos } = useVideos();
  const { status: uploadStatus, doneUpload } = useUpload();
  const myAlbumIdRef = useRef<number | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isCreateAlbumOpen, setIsCreateAlbumOpen] = useState(false);
  const [myAlbumId, setMyAlbumId] = useState<number | null>(null);
  const [sharedAlbums, setSharedAlbums] = useState<SharedAlbumItem[]>([]);
  const [activeSharedAlbumId, setActiveSharedAlbumId] = useState<number | null>(null);
  const [activeMyAlbumId, setActiveMyAlbumId] = useState<number | null>(null);
  const [activeSharedAlbumDetail, setActiveSharedAlbumDetail] = useState<SharedAlbumDetail | null>(null);
  const [renameTargetId, setRenameTargetId] = useState<number | null>(null);
  const [leaveTargetId, setLeaveTargetId] = useState<number | null>(null);

  const renameTargetName = sharedAlbums.find((a) => a.id === renameTargetId)?.name ?? "";
  const leaveTargetName = sharedAlbums.find((a) => a.id === leaveTargetId)?.name ?? "";

  // AI 처리 완료 시 영상 목록 갱신
  useEffect(() => {
    if (uploadStatus === "done" && myAlbumIdRef.current) {
      fetchVideos(myAlbumIdRef.current).catch(() => {});
    }
  }, [uploadStatus]);

  useEffect(() => {
    getAlbums().then(async (albums) => {
      const my = albums.find((a) => a.name === "내 앨범" && a.memberCount === 1);
      const shared = albums.filter((a) => !(a.name === "내 앨범" && a.memberCount === 1));
      if (my) {
        setMyAlbumId(my.albumId);
        setActiveMyAlbumId(my.albumId);
        myAlbumIdRef.current = my.albumId;
      }
      const sharedWithMembers = await Promise.all(
        shared.map(async (a) => {
          const members = await getAlbumMembers(a.albumId).catch(() => []);
          return {
            id: a.albumId,
            name: a.name,
            members: members.map((m) => ({
              userId: m.userId,
              nickname: m.nickname,
              profileImageUrl: m.profileImageUrl || null,
              avatarColor: COLORS[m.userId % COLORS.length],
              isMe: m.isMe,
            })),
          };
        })
      );
      setSharedAlbums(sharedWithMembers);

      // 뷰어에서 뒤로가기로 돌아온 경우 해당 공유 앨범 자동 선택 + detail 로드
      const openAlbumId = location.state?.openAlbumId as number | undefined;
      if (openAlbumId && sharedWithMembers.some((a) => a.id === openAlbumId)) {
        setActiveSharedAlbumId(openAlbumId);
        setActiveMyAlbumId(null);
        setActiveSharedAlbumDetail(null);
        const albumName = sharedWithMembers.find((a) => a.id === openAlbumId)?.name ?? "";
        Promise.all([getAlbumMembers(openAlbumId), getAlbumVideos(openAlbumId)])
          .then(async ([members, videos]) => {
            const reactionsList = await Promise.all(
              videos.map((v) => getVideoReactions(v.videoId ?? v.albumVideoId).catch(() => ({ videoId: v.videoId, reactions: [] })))
            );
            const meParticipant = members.find((m) => m.isMe);
            setActiveSharedAlbumDetail({
              id: openAlbumId,
              name: albumName,
              participants: members.map((m) => ({
                id: m.userId,
                name: m.nickname,
                avatarColor: COLORS[m.userId % COLORS.length],
                profileImageUrl: m.profileImageUrl ?? null,
                isMe: m.isMe,
                code: m.userCode,
              })),
              videos: videos.map((v, i) => {
                const uploader = v.uploaderId
                  ? members.find((m) => m.userId === v.uploaderId)
                  : members.find((m) => m.nickname === v.uploaderName);
                const isMe =
                  v.isMe !== undefined
                    ? v.isMe
                    : uploader
                    ? uploader.isMe
                    : !!(me && me.nickname === v.uploaderName);
                const rawReactions = reactionsList[i]?.reactions ?? [];
                return {
                  id: v.albumVideoId,
                  videoId: v.videoId ?? v.albumVideoId,
                  title: v.title,
                  thumbnail: v.thumbnailUrl ?? undefined,
                  duration: v.durationSec != null ? `${Math.floor(v.durationSec / 60)}:${String(v.durationSec % 60).padStart(2, "0")}` : "",
                  date: v.createdAt.slice(0, 10).replace(/-/g, "."),
                  uploadedBy: {
                    id: uploader?.userId ?? (isMe ? (meParticipant?.userId ?? 0) : 0),
                    name: v.uploaderName,
                    avatarColor: uploader
                      ? COLORS[uploader.userId % COLORS.length]
                      : isMe && meParticipant
                      ? COLORS[meParticipant.userId % COLORS.length]
                      : "#94A3B8",
                    profileImageUrl: uploader?.profileImageUrl ?? null,
                    isMe,
                  },
                  reactions: rawReactions.map((r) => ({ emoji: r.emoji, count: r.count, reacted: r.selected })),
                  commentCount: v.commentCount,
                };
              }),
            });
          }).catch(() => {});
      }
    }).catch(() => {});
  }, []);

  const handleVideoCompleted = (_videoId: number) => {
    if (myAlbumIdRef.current) {
      fetchVideos(myAlbumIdRef.current).catch(() => {});
    }
    doneUpload();
  };

  const handleClickMyAlbum = (albumId: number) => {
    setActiveMyAlbumId(albumId);
    setActiveSharedAlbumId(null);
    setActiveSharedAlbumDetail(null);
  };

  const handleClickSharedAlbum = (albumId: number) => {
    if (!albumId || albumId <= 0 || !Number.isFinite(albumId)) return;
    setActiveSharedAlbumId(albumId);
    setActiveMyAlbumId(null);
    setActiveSharedAlbumDetail(null);
    const albumName = sharedAlbums.find((a) => a.id === albumId)?.name ?? "";
    Promise.all([getAlbumMembers(albumId), getAlbumVideos(albumId)])
      .then(async ([members, videos]) => {
        const reactionsList = await Promise.all(
          videos.map((v) => getVideoReactions(v.videoId ?? v.albumVideoId).catch(() => ({ videoId: v.videoId, reactions: [] })))
        );
        const meParticipant = members.find((m) => m.isMe);
        setActiveSharedAlbumDetail({
          id: albumId,
          name: albumName,
          participants: members.map((m) => ({
            id: m.userId,
            name: m.nickname,
            avatarColor: COLORS[m.userId % COLORS.length],
            profileImageUrl: m.profileImageUrl ?? null,
            isMe: m.isMe,
            code: m.userCode,
          })),
          videos: videos.map((v, i) => {
            const uploader = v.uploaderId
              ? members.find((m) => m.userId === v.uploaderId)
              : members.find((m) => m.nickname === v.uploaderName);
            const isMe =
              v.isMe !== undefined
                ? v.isMe
                : uploader
                ? uploader.isMe
                : !!(me && me.nickname === v.uploaderName);
            const rawReactions = reactionsList[i]?.reactions ?? [];
            return {
              id: v.albumVideoId,
              videoId: v.videoId ?? v.albumVideoId,
              title: v.title,
              thumbnail: v.thumbnailUrl ?? undefined,
              duration: v.durationSec != null ? `${Math.floor(v.durationSec / 60)}:${String(v.durationSec % 60).padStart(2, "0")}` : "",
              date: v.createdAt.slice(0, 10).replace(/-/g, "."),
              uploadedBy: {
                id: uploader?.userId ?? (isMe ? (meParticipant?.userId ?? 0) : 0),
                name: v.uploaderName,
                avatarColor: uploader
                  ? COLORS[uploader.userId % COLORS.length]
                  : isMe && meParticipant
                  ? COLORS[meParticipant.userId % COLORS.length]
                  : "#94A3B8",
                profileImageUrl: uploader?.profileImageUrl ?? null,
                isMe,
              },
              reactions: rawReactions.map((r) => ({ emoji: r.emoji, count: r.count, reacted: r.selected })),
              commentCount: v.commentCount,
            };
          }),
        });
      })
      .catch((e) => { console.error("[SharedAlbum] 로딩 실패:", e); });
  };

  const handleRename = (newName: string) => {
    if (renameTargetId === null) return;
    const id = renameTargetId;
    setSharedAlbums((prev) => prev.map((a) => (a.id === id ? { ...a, name: newName, members: a.members } : a)));
    if (activeSharedAlbumDetail?.id === id) {
      setActiveSharedAlbumDetail((prev) => prev ? { ...prev, name: newName } : prev);
    }
    setRenameTargetId(null);
    editAlbumTitle(id, newName).catch(console.error);
  };

  const handleLeave = async () => {
    if (leaveTargetId === null) return;
    const id = leaveTargetId;
    await leaveAlbum(id).catch(() => {});
    setSharedAlbums((prev) => prev.filter((a) => a.id !== id));
    if (activeSharedAlbumId === id) {
      setActiveSharedAlbumId(null);
      setActiveSharedAlbumDetail(null);
    }
    setLeaveTargetId(null);
  };

  const handleCreateAlbum = async (friends: { id: number; name: string; code: string; avatarColor: string }[]) => {
    const albumName = friends.map((f) => f.name).join(", ");
    const res = await createAlbum({
      name: albumName,
      memberCodes: friends.map((f) => f.code),
    });
    const newMembers = await getAlbumMembers(res.albumId).catch(() => []);
    setSharedAlbums((prev) => [...prev, {
      id: res.albumId,
      name: res.name,
      members: newMembers.map((m) => ({
        userId: m.userId,
        nickname: m.nickname,
        profileImageUrl: m.profileImageUrl || null,
        avatarColor: COLORS[m.userId % COLORS.length],
        isMe: m.isMe,
      })),
    }]);
  };

  return (
    <div className="h-screen flex flex-col bg-[#F4F7FF] overflow-hidden">
      <MainHeader
        userName={me?.nickname ?? ""}
        userCode={me?.userCode}
        profileImageUrl={me?.profileImageUrl}
        onClickLogo={() => navigate("/main")}
        onClickHelp={() => {}}
        onClickProfile={() => {}}
        onVideoCompleted={handleVideoCompleted}
      />

      <div className="flex flex-1 overflow-hidden flex-col lg:flex-row pb-14 lg:pb-0">
        <MainSidebar
          myAlbums={myAlbumId ? [{ id: myAlbumId, name: "내 앨범" }] : []}
          sharedAlbums={sharedAlbums}
          activeMyAlbumId={activeSharedAlbumId === null ? (activeMyAlbumId ?? undefined) : undefined}
          activeSharedAlbumId={activeSharedAlbumId ?? undefined}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed((prev) => !prev)}
          onClickMyAlbum={handleClickMyAlbum}
          onClickSharedAlbum={handleClickSharedAlbum}
          onClickSharedAlbumRename={(albumId) => setRenameTargetId(albumId)}
          onClickSharedAlbumLeave={(albumId) => setLeaveTargetId(albumId)}
          onClickCreateSharedAlbum={() => setIsCreateAlbumOpen(true)}
        />

        <div className={activeSharedAlbumId === null ? "flex flex-1 overflow-hidden" : "hidden"}>
          <MainContent sharedAlbums={sharedAlbums} albumId={activeMyAlbumId} />
        </div>

        {activeSharedAlbumId !== null && (
          <div className="flex flex-1 overflow-hidden">
            {activeSharedAlbumDetail ? (
              <SharedAlbumContent album={activeSharedAlbumDetail} myAlbumId={myAlbumId} />
            ) : (
              <div className="flex flex-1 items-center justify-center text-sm text-[#94A3B8]">
                앨범을 불러오는 중입니다...
              </div>
            )}
          </div>
        )}
      </div>

      <CreateSharedAlbumModal
        isOpen={isCreateAlbumOpen}
        onClose={() => setIsCreateAlbumOpen(false)}
        onConfirm={(friends) => {
          handleCreateAlbum(friends).catch(() => {});
          setIsCreateAlbumOpen(false);
        }}
      />
      <RenameSharedAlbumModal
        isOpen={renameTargetId !== null}
        currentName={renameTargetName}
        onClose={() => setRenameTargetId(null)}
        onConfirm={handleRename}
      />
      <ConfirmModal
        open={leaveTargetId !== null}
        title="공유 앨범에서 나가시겠습니까?"
        description={`"${leaveTargetName}" 앨범에서 나가면 더 이상 해당 앨범을 볼 수 없습니다.`}
        confirmText="나가기"
        onClose={() => setLeaveTargetId(null)}
        onConfirm={handleLeave}
      />
    </div>
  );
}
