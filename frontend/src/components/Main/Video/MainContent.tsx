// 메인 페이지 우측 콘텐츠 영역 전체를 조립하는 컴포넌트 파일
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { SortOption } from "../../../types/video";
import type { SharedAlbumItem } from "../../../types/sidebar";
import ConfirmModal from "./ConfirmModal";
import VideoGrid from "./VideoGrid";
import VideoSectionHeader from "./VideoSectionHeader";
import VideoToolbar from "./VideoToolbar";
import ShareToAlbumModal from "./ShareToAlbumModal";
import { useVideos } from "../../../context/VideosContext";
import { addVideosToAlbum } from "../../../api/album";
import { deleteVideo } from "../../../api/video";

type MainContentProps = {
  sharedAlbums: SharedAlbumItem[];
  albumId: number | null;
};

export default function MainContent({ sharedAlbums, albumId }: MainContentProps) {
  const navigate = useNavigate();
  const { videos, fetchVideos, removeVideo, renameVideo } = useVideos();

  useEffect(() => {
    if (albumId !== null && albumId > 0 && Number.isFinite(albumId)) fetchVideos(albumId);
  }, [albumId]);
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
      if (sortOption === "latest") return b.date.localeCompare(a.date);
      if (sortOption === "oldest") return a.date.localeCompare(b.date);
      if (sortOption === "title") return a.title.localeCompare(b.title, "ko");
      if (sortOption === "uploader") return a.uploaderName.localeCompare(b.uploaderName, "ko");
      return 0;
    });

    return sortedVideos;
  }, [videos, searchKeyword, sortOption]);

  const handleRenameTitle = (videoId: number, newTitle: string) => {
    renameVideo(videoId, newTitle);
  };

  const handleEdit = (videoId: number) => {
    const video = videos.find((v) => v.id === videoId);
    navigate("/edit", { state: { video } });
  };

  const handleShare = (videoId: number) => {
    setShareTargetId(videoId);
  };

  const handleDelete = (videoId: number) => {
    setDeleteTargetId(videoId);
  };

  const handleCloseDeleteModal = () => {
    setDeleteTargetId(null);
  };

  const handleConfirmDelete = async () => {
    if (deleteTargetId !== null) {
      // videos.id(videoId)로 삭제 API 호출 — albumVideoId(id)가 아님
      const target = videos.find((v) => v.id === deleteTargetId);
      if (target) await deleteVideo(target.videoId).catch(() => {});
      removeVideo(deleteTargetId);
    }
    setDeleteTargetId(null);
  };

  const handleConfirmShare = async (albumIds: number[]) => {
    if (shareTargetId !== null) {
      // videos.id(videoId)로 공유 — albumVideoId(id)가 아님
      const target = videos.find((v) => v.id === shareTargetId);
      if (target) {
        await Promise.all(albumIds.map((id) => addVideosToAlbum(id, [target.videoId]).catch(() => {})));
      }
    }
    setShareTargetId(null);
  };

  const deleteTargetTitle =
    videos.find((video) => video.id === deleteTargetId)?.title ?? "";
  const shareTargetTitle =
    videos.find((video) => video.id === shareTargetId)?.title ?? "";

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* 상단 헤더 + 툴바 */}
      <div className="bg-white/80 backdrop-blur-sm px-4 pt-5 pb-4 sm:px-6 sm:pt-6 sm:pb-5 lg:px-8 lg:pt-8 border-b border-[#E8EDF4]">
        <div className="mx-auto max-w-[1280px] space-y-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <VideoSectionHeader title="내 앨범" count={videos.length} />
            <button
              type="button"
              onClick={() => navigate("/upload")}
              className="flex items-center gap-2 rounded-full bg-gradient-to-r from-[#2563EB] to-[#6366F1] px-3 py-2.5 sm:px-5 text-sm font-semibold text-white shadow-sm transition-all hover:shadow-md hover:opacity-90"
            >
              <span className="hidden sm:inline">새 영상 변환</span>
              <span className="sm:hidden">변환</span>
            </button>
          </div>
          <VideoToolbar
            searchKeyword={searchKeyword}
            sortOption={sortOption}
            onChangeSearchKeyword={setSearchKeyword}
            onChangeSortOption={setSortOption}
          />
        </div>
      </div>

      {/* 영상 그리드 — 흰 배경으로 나머지 전체 채움 */}
      <div className="flex-1 overflow-y-auto bg-[#F4F7FF]">
        <div className="mx-auto max-w-[1280px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <VideoGrid
            videos={filteredVideos}
            onEdit={handleEdit}
            onShare={handleShare}
            onDelete={handleDelete}
            onRenameTitle={handleRenameTitle}
          />
        </div>
      </div>

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
    </div>
  );
}
