// 메인 페이지 전체 레이아웃을 조립하는 페이지 파일
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getAlbums, editAlbumTitle, createAlbum, leaveAlbum, getAlbumMembers } from "../api/album";
import { useUser } from "../context/UserContext";
import MainHeader from "../components/Main/Header/MainHeader";
import MainSidebar from "../components/Main/Sidebar/MainSidebar";
import MainContent from "../components/Main/Video/MainContent";
import CreateSharedAlbumModal from "../components/Main/Sidebar/CreateSharedAlbumModal";
import RenameSharedAlbumModal from "../components/Main/Sidebar/RenameSharedAlbumModal";
import SharedAlbumContent from "../components/Main/SharedAlbum/SharedAlbumContent";
import ConfirmModal from "../components/Main/Video/ConfirmModal";
import type { MyAlbumItem, SharedAlbumItem } from "../types/sidebar";
import type { SharedAlbumDetail } from "../types/sharedAlbum";

export default function MainPage() {
  const navigate = useNavigate();
  const { me } = useUser();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isCreateAlbumOpen, setIsCreateAlbumOpen] = useState(false);
  const [myAlbums, setMyAlbums] = useState<MyAlbumItem[]>([]);
  const [sharedAlbums, setSharedAlbums] = useState<SharedAlbumItem[]>([]);
  const [sharedAlbumDetails, setSharedAlbumDetails] = useState<SharedAlbumDetail[]>([]);
  const [activeSharedAlbumId, setActiveSharedAlbumId] = useState<number | null>(null);
  const [activeMyAlbumId, setActiveMyAlbumId] = useState<number>(0);

  const AVATAR_COLORS = ["#8B5CF6", "#3B82F6", "#EC4899", "#F59E0B", "#10B981", "#EF4444"];
  const getAvatarColor = (name: string) => {
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
  };

  useEffect(() => {
    getAlbums().then(async (albums) => {
      const mine = albums.filter((a) => a.name === "내 앨범" && a.memberCount === 1).map((a) => ({ id: a.albumId, name: a.name }));
      const shared = albums.filter((a) => !(a.name === "내 앨범" && a.memberCount === 1)).map((a) => ({ id: a.albumId, name: a.name }));
      setMyAlbums(mine);
      setSharedAlbums(shared);
      if (mine.length > 0) setActiveMyAlbumId(mine[0].id);

      const details = await Promise.all(
        shared.map(async (a) => {
          const members = await getAlbumMembers(a.id).catch(() => []);
          return {
            id: a.id,
            name: a.name,
            participants: members.map((m) => ({
              id: m.userId,
              name: m.nickname,
              avatarColor: getAvatarColor(m.nickname),
              isMe: m.isMe,
              code: m.userCode,
            })),
            videos: [],
          };
        })
      );
      setSharedAlbumDetails(details);
    });
  }, []);
  const [renameTargetId, setRenameTargetId] = useState<number | null>(null);
  const [leaveTargetId, setLeaveTargetId] = useState<number | null>(null);

  const renameTargetName = sharedAlbums.find((a) => a.id === renameTargetId)?.name ?? "";
  const leaveTargetName = sharedAlbums.find((a) => a.id === leaveTargetId)?.name ?? "";

  const handleClickMyAlbum = (albumId: number) => {
    setActiveMyAlbumId(albumId);
    setActiveSharedAlbumId(null);
  };

  const handleClickSharedAlbum = (albumId: number) => {
    setActiveSharedAlbumId(albumId);
    setActiveMyAlbumId(0);
  };

  const handleRename = (newName: string) => {
    if (renameTargetId === null) return;
    const id = renameTargetId;
    setSharedAlbums((prev) =>
      prev.map((a) => (a.id === id ? { ...a, name: newName } : a))
    );
    setSharedAlbumDetails((prev) =>
      prev.map((d) => (d.id === id ? { ...d, name: newName } : d))
    );
    setRenameTargetId(null);
    editAlbumTitle(id, newName).catch(console.error);
  };

  const handleLeave = () => {
    if (leaveTargetId === null) return;
    const id = leaveTargetId;
    setSharedAlbums((prev) => prev.filter((a) => a.id !== id));
    setSharedAlbumDetails((prev) => prev.filter((d) => d.id !== id));
    if (activeSharedAlbumId === id) setActiveSharedAlbumId(null);
    setLeaveTargetId(null);
    leaveAlbum(id).catch(console.error);
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

      <div className="flex flex-1 overflow-hidden flex-col lg:flex-row">
        <MainSidebar
          myAlbums={myAlbums}
          sharedAlbums={sharedAlbums}
          activeMyAlbumId={activeSharedAlbumId === null ? activeMyAlbumId : undefined}
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
        {sharedAlbumDetails.map((albumDetail) => (
          <div
            key={albumDetail.id}
            className={activeSharedAlbumId === albumDetail.id ? "flex flex-1 overflow-hidden" : "hidden"}
          >
            <SharedAlbumContent album={albumDetail} />
          </div>
        ))}
      </div>

      <CreateSharedAlbumModal
        isOpen={isCreateAlbumOpen}
        onClose={() => setIsCreateAlbumOpen(false)}
        onConfirm={(friends) => {
          const albumName = friends.map((f) => f.name).join(", ");
          createAlbum({
            name: albumName,
            memberCodes: friends.map((f) => f.code),
          }).then((res) => {
            const newAlbum: SharedAlbumItem = { id: res.albumId, name: res.name };
            const newDetail: SharedAlbumDetail = {
              id: res.albumId,
              name: res.name,
              participants: [
                { id: me?.id ?? 0, name: me?.nickname ?? "", avatarColor: "#8B5CF6", isMe: true },
                ...friends.map((f) => ({
                  id: f.id,
                  name: f.name,
                  avatarColor: f.avatarColor,
                })),
              ],
              videos: [],
            };
            setSharedAlbums((prev) => [...prev, newAlbum]);
            setSharedAlbumDetails((prev) => [...prev, newDetail]);
          }).catch(console.error);
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
