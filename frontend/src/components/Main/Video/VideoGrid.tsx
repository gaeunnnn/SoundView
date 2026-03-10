// 영상 카드 목록을 그리드 형태로 렌더링하는 컴포넌트 파일
import type { VideoItem } from "../../../types/video";
import VideoCard from "./VideoCard";

type VideoGridProps = {
  videos: VideoItem[];
  openedMenuId: number | null;
  onToggleMenu: (videoId: number) => void;
  onEdit: (videoId: number) => void;
  onShare: (videoId: number) => void;
  onDelete: (videoId: number) => void;
  onRenameTitle: (videoId: number, newTitle: string) => void;
};

export default function VideoGrid({
  videos,
  openedMenuId,
  onToggleMenu,
  onEdit,
  onShare,
  onDelete,
  onRenameTitle,
}: VideoGridProps) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
      {videos.map((video) => (
        <VideoCard
          key={video.id}
          video={video}
          isMenuOpen={openedMenuId === video.id}
          onToggleMenu={onToggleMenu}
          onEdit={onEdit}
          onShare={onShare}
          onDelete={onDelete}
          onRenameTitle={onRenameTitle}
        />
      ))}
    </div>
  );
}