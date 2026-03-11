// 메인 페이지 좌측 사이드바 전체 레이아웃을 조립하는 컴포넌트 파일
import { Plus } from "lucide-react";
import type { MainSidebarProps } from "../../../types/sidebar";
import SidebarAlbumItem from "./SidebarAlbumItem";
import SidebarCollapseButton from "./SidebarCollapseButton";
import SidebarFriendItem from "./SidebarFriendItem";
import SidebarSection from "./SidebarSection";

export default function MainSidebar({
  myAlbums,
  sharedAlbums,
  activeMyAlbumId,
  activeSharedAlbumId,
  isCollapsed,
  onToggleCollapse,
  onClickMyAlbum,
  onClickSharedAlbum,
  onClickSharedAlbumRename,
  onClickSharedAlbumLeave,
  onClickCreateSharedAlbum,
}: MainSidebarProps) {
  return (
    <aside
      className={[
        "group relative hidden border-r border-[#E8EDF4] bg-white lg:flex lg:h-[calc(100vh-72px)] lg:flex-col",
        isCollapsed ? "lg:w-[72px]" : "lg:w-[240px]",
      ].join(" ")}
    >
      <SidebarCollapseButton
        isCollapsed={isCollapsed}
        onClick={onToggleCollapse}
      />

      <div className="flex h-full flex-col px-3 py-4 transition-all">
        <div className="flex-1 space-y-6 overflow-y-auto">
          <SidebarSection title="내 앨범" isCollapsed={isCollapsed}>
            {myAlbums.map((album) => (
              <SidebarAlbumItem
                key={album.id}
                label={album.name}
                isActive={album.id === activeMyAlbumId}
                isCollapsed={isCollapsed}
                onClick={() => onClickMyAlbum?.(album.id)}
              />
            ))}
          </SidebarSection>

          {!isCollapsed && <div className="border-t border-[#EEF2F7]" />}

          <SidebarSection title="공유 앨범" isCollapsed={isCollapsed}>
            {sharedAlbums.length > 0 ? (
              sharedAlbums.map((album) => (
                <SidebarFriendItem
                  key={album.id}
                  label={album.name}
                  isActive={album.id === activeSharedAlbumId}
                  isCollapsed={isCollapsed}
                  onClick={() => onClickSharedAlbum?.(album.id)}
                  onClickRename={() => onClickSharedAlbumRename?.(album.id)}
                  onClickLeave={() => onClickSharedAlbumLeave?.(album.id)}
                />
              ))
            ) : isCollapsed ? null : (
              <div className="rounded-xl bg-[#F8FAFC] px-4 py-4 text-sm leading-6 text-[#94A3B8]">
                아직 공유 앨범이 없습니다.
              </div>
            )}

            <button
              type="button"
              onClick={onClickCreateSharedAlbum}
              title={isCollapsed ? "공유 앨범 만들기" : undefined}
              className={[
                "mt-2 flex rounded-2xl border border-dashed border-[#BFDBFE] bg-[#F8FBFF] text-sm font-semibold text-[#2563EB] transition-colors hover:bg-[#F0F7FF]",
                isCollapsed
                  ? "h-11 w-full items-center justify-center"
                  : "h-11 w-full items-center gap-3 px-4",
              ].join(" ")}
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#E8F1FF]">
                <Plus size={14} strokeWidth={2.5} />
              </span>

              {!isCollapsed && <span>공유 앨범 만들기</span>}
            </button>
          </SidebarSection>
        </div>

      </div>
    </aside>
  );
}