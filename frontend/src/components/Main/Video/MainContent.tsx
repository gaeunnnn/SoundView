// 메인 페이지 우측 콘텐츠 영역 전체를 조립하는 컴포넌트 파일
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { SortOption, VideoItem } from "../../../types/video";
import type { SharedAlbumItem } from "../../../types/sidebar";
import ConfirmModal from "./ConfirmModal";
import VideoGrid from "./VideoGrid";
import VideoSectionHeader from "./VideoSectionHeader";
import VideoToolbar from "./VideoToolbar";
import ShareToAlbumModal from "./ShareToAlbumModal";

type MainContentProps = {
  videos: VideoItem[];
  sharedAlbums: SharedAlbumItem[];
};

export default function MainContent({ videos: initialVideos, sharedAlbums }: MainContentProps) {
  const navigate = useNavigate();
  const [videos, setVideos] = useState<VideoItem[]>(initialVideos);
  const [openedMenuId, setOpenedMenuId] = useState<number | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null);
  const [shareTargetId, setShareTargetId] = useState<number | null>(null);
  const [searchKeyword, setSearchKeyword] = useState("");
  const [sortOption, setSortOption] = useState<SortOption>("latest");

  const filteredVideos = useMemo(() => {
    const normalizedKeyword = searchKeyword.replace(/\s/g, "").toLowerCase();

    const searchedVideos = normalizedKeyword
      ? videos.filter((video) =>
          video.title.replace(/\s/g, "").toLowerCase().includes(normalizedKeyword),
        )
      : videos;

    const sortedVideos = [...searchedVideos].sort((a, b) => {
      if (sortOption === "latest") {
        return b.date.localeCompare(a.date);
      }

      return a.date.localeCompare(b.date);
    });

    return sortedVideos;
  }, [videos, searchKeyword, sortOption]);

  const handleToggleMenu = (videoId: number) => {
    setOpenedMenuId((prev) => (prev === videoId ? null : videoId));
  };

  const handleRenameTitle = (videoId: number, newTitle: string) => {
    setVideos((prev) =>
      prev.map((v) => (v.id === videoId ? { ...v, title: newTitle } : v))
    );
  };

  const handleEdit = (videoId: number) => {
    setOpenedMenuId(null);
    console.log("편집 클릭", videoId);
  };

  const handleShare = (videoId: number) => {
    setOpenedMenuId(null);
    setShareTargetId(videoId);
  };

  const handleDelete = (videoId: number) => {
    setOpenedMenuId(null);
    setDeleteTargetId(videoId);
  };

  const handleCloseDeleteModal = () => {
    setDeleteTargetId(null);
  };

  const handleConfirmDelete = () => {
    setVideos((prev) => prev.filter((v) => v.id !== deleteTargetId));
    setDeleteTargetId(null);
  };

  const handleConfirmShare = (albumIds: number[]) => {
    console.log("공유 완료 - 영상:", shareTargetId, "→ 앨범:", albumIds);
    setShareTargetId(null);
  };

  const deleteTargetTitle =
    videos.find((video) => video.id === deleteTargetId)?.title ?? "";
  const shareTargetTitle =
    videos.find((video) => video.id === shareTargetId)?.title ?? "";

  return (
    <>
      <section className="flex-1 overflow-y-auto bg-[#FAFBFD] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <div className="mx-auto max-w-[1280px] space-y-8 lg:space-y-10">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <VideoSectionHeader title="내 앨범" count={videos.length} />

            <button
              type="button"
              onClick={() => navigate("/upload")}
              className="w-full rounded-full bg-[#2563EB] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#1D4ED8] sm:w-auto"
            >
              새 영상 변환
            </button>
          </div>

          <VideoToolbar
            searchKeyword={searchKeyword}
            sortOption={sortOption}
            onChangeSearchKeyword={setSearchKeyword}
            onChangeSortOption={setSortOption}
          />

          <VideoGrid
            videos={filteredVideos}
            openedMenuId={openedMenuId}
            onToggleMenu={handleToggleMenu}
            onEdit={handleEdit}
            onShare={handleShare}
            onDelete={handleDelete}
            onRenameTitle={handleRenameTitle}
          />
        </div>
      </section>

      <ConfirmModal
        open={deleteTargetId !== null}
        title="영상을 삭제하시겠습니까?"
        description={`"${deleteTargetTitle}" 영상이 영구적으로 삭제됩니다. 이 작업은 되돌릴 수 없습니다.`}
        confirmText="삭제하기"
        onClose={handleCloseDeleteModal}
        onConfirm={handleConfirmDelete}
      />

      <ShareToAlbumModal
        isOpen={shareTargetId !== null}
        videoTitle={shareTargetTitle}
        sharedAlbums={sharedAlbums}
        onClose={() => setShareTargetId(null)}
        onConfirm={handleConfirmShare}
      />
    </>
  );
}
