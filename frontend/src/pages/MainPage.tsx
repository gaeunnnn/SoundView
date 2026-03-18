// 메인 페이지 전체 레이아웃을 조립하는 페이지 파일
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getAlbums, editAlbumTitle, leaveAlbum, createAlbum, getAlbumMembers, getAlbumVideos } from "../api/album";
import { useUser } from "../context/UserContext";
import MainHeader from "../components/Main/Header/MainHeader";
import MainSidebar from "../components/Main/Sidebar/MainSidebar";
import MainContent from "../components/Main/Video/MainContent";
import SharedAlbumContent from "../components/Main/SharedAlbum/SharedAlbumContent";
import CreateSharedAlbumModal from "../components/Main/Sidebar/CreateSharedAlbumModal";
import RenameSharedAlbumModal from "../components/Main/Sidebar/RenameSharedAlbumModal";
import ConfirmModal from "../components/Main/Video/ConfirmModal";
import type { SharedAlbumItem } from "../types/sidebar";
import type { SharedAlbumDetail } from "../types/sharedAlbum";

const COLORS = ["#8B5CF6", "#3B82F6", "#EC4899", "#F59E0B", "#10B981", "#EF4444"];

export default function MainPage() {
  const navigate = useNavigate();
  const { me } = useUser();
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

  useEffect(() => {
    getAlbums().then((albums) => {
      const my = albums.find((a) => a.name === "내 앨범" && a.memberCount === 1);
      const shared = albums.filter((a) => !(a.name === "내 앨범" && a.memberCount === 1));
      if (my) {
        setMyAlbumId(my.albumId);
        setActiveMyAlbumId(my.albumId);
      }
      setSharedAlbums(shared.map((a) => ({ id: a.albumId, name: a.name })));
    }).catch(() => {});
  }, []);

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
      .then(([members, videos]) => {
        setActiveSharedAlbumDetail({
          id: albumId,
          name: albumName,
          participants: members.map((m) => ({
            id: m.userId,
            name: m.nickname,
            avatarColor: COLORS[m.userId % COLORS.length],
            isMe: m.isMe,
            code: m.userCode,
          })),
          videos: videos.map((v) => {
            const uploader = members.find((m) => m.nickname === v.uploaderName);
            return {
              id: v.videoId,
              title: v.title,
              thumbnail: v.thumbnailUrl ?? "",
              duration: v.durationSec != null ? `${Math.floor(v.durationSec / 60)}:${String(v.durationSec % 60).padStart(2, "0")}` : "",
              date: v.createdAt.slice(0, 10).replace(/-/g, "."),
              uploadedBy: {
                id: uploader?.userId ?? 0,
                name: v.uploaderName,
                avatarColor: uploader ? COLORS[uploader.userId % COLORS.length] : "#94A3B8",
                isMe: uploader?.isMe ?? false,
              },
              reactions: [],
              commentCount: v.commentCount,
            };
          }),
        });
      })
      .catch(() => {});
  };

  const handleRename = (newName: string) => {
    if (renameTargetId === null) return;
    const id = renameTargetId;
    setSharedAlbums((prev) => prev.map((a) => (a.id === id ? { ...a, name: newName } : a)));
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
    setSharedAlbums((prev) => [...prev, { id: res.albumId, name: res.name }]);
  };

  return (
    <div className="h-screen flex flex-col bg-[#FAFBFD] overflow-hidden">
      <MainHeader
        userName={me?.nickname ?? ""}
        userCode={me?.userCode}
        onClickLogo={() => navigate("/main")}
        onClickHelp={() => console.log("도움말 클릭")}
        onClickProfile={() => console.log("프로필 클릭")}
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
