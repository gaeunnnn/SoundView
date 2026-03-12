// 메인 페이지 전체 레이아웃을 조립하는 페이지 파일
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import MainHeader from "../components/Main/Header/MainHeader";
import MainSidebar from "../components/Main/Sidebar/MainSidebar";
import MainContent from "../components/Main/Video/MainContent";
import CreateSharedAlbumModal from "../components/Main/Sidebar/CreateSharedAlbumModal";
import RenameSharedAlbumModal from "../components/Main/Sidebar/RenameSharedAlbumModal";
import SharedAlbumContent from "../components/Main/SharedAlbum/SharedAlbumContent";
import ConfirmModal from "../components/Main/Video/ConfirmModal";
import { MY_ALBUMS, SHARED_ALBUMS } from "../constants/mainSidebar";
import { SHARED_ALBUM_DETAILS } from "../constants/sharedAlbums";
import type { SharedAlbumItem } from "../types/sidebar";
import type { SharedAlbumDetail } from "../types/sharedAlbum";

const ME = { id: 0, name: "박민준", avatarColor: "#8B5CF6", isMe: true };

export default function MainPage() {
  const navigate = useNavigate();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isCreateAlbumOpen, setIsCreateAlbumOpen] = useState(false);
  const [sharedAlbums, setSharedAlbums] = useState<SharedAlbumItem[]>(SHARED_ALBUMS);
  const [sharedAlbumDetails, setSharedAlbumDetails] = useState<SharedAlbumDetail[]>(SHARED_ALBUM_DETAILS);
  const [activeSharedAlbumId, setActiveSharedAlbumId] = useState<number | null>(null);
  const [activeMyAlbumId, setActiveMyAlbumId] = useState<number>(1);
  const [renameTargetId, setRenameTargetId] = useState<number | null>(null);
  const [leaveTargetId, setLeaveTargetId] = useState<number | null>(null);

  const activeSharedAlbum = activeSharedAlbumId !== null
    ? sharedAlbumDetails.find((d) => d.id === activeSharedAlbumId) ?? null
    : null;

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
    setSharedAlbums((prev) =>
      prev.map((a) => (a.id === renameTargetId ? { ...a, name: newName } : a))
    );
    setSharedAlbumDetails((prev) =>
      prev.map((d) => (d.id === renameTargetId ? { ...d, name: newName } : d))
    );
    setRenameTargetId(null);
  };

  const handleLeave = () => {
    setSharedAlbums((prev) => prev.filter((a) => a.id !== leaveTargetId));
    setSharedAlbumDetails((prev) => prev.filter((d) => d.id !== leaveTargetId));
    if (activeSharedAlbumId === leaveTargetId) setActiveSharedAlbumId(null);
    setLeaveTargetId(null);
  };

  return (
    <div className="h-screen flex flex-col bg-[#FAFBFD] overflow-hidden">
      <MainHeader
        userName="박민준"
        onClickLogo={() => navigate("/main")}
        onClickHelp={() => console.log("도움말 클릭")}
        onClickNotification={() => console.log("알림 클릭")}
        onClickProfile={() => console.log("프로필 클릭")}
      />

      <div className="flex flex-1 overflow-hidden flex-col lg:flex-row">
        <MainSidebar
          myAlbums={MY_ALBUMS}
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
          <MainContent sharedAlbums={sharedAlbums} />
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
          const newId = Date.now();
          const albumName = friends.map((f) => f.name).join(", ");

          const newAlbum: SharedAlbumItem = { id: newId, name: albumName };
          const newDetail: SharedAlbumDetail = {
            id: newId,
            name: albumName,
            participants: [
              ME,
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
