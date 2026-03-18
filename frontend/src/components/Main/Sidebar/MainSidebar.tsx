// 메인 페이지 좌측 사이드바 전체 레이아웃을 조립하는 컴포넌트 파일
import { useState } from "react";
import { Plus, X, BookOpen, Users } from "lucide-react";
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
  const [mobileOpen, setMobileOpen] = useState(false);

  const sidebarContent = (
    <div className="flex h-full flex-col px-3 py-4">
      <div className="flex-1 space-y-6 overflow-y-auto">
        <SidebarSection title="내 앨범" isCollapsed={isCollapsed}>
          {myAlbums.map((album) => (
            <SidebarAlbumItem
              key={album.id}
              label={album.name}
              isActive={album.id === activeMyAlbumId}
              isCollapsed={isCollapsed}
              onClick={() => { onClickMyAlbum?.(album.id); setMobileOpen(false); }}
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
                onClick={() => { onClickSharedAlbum?.(album.id); setMobileOpen(false); }}
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
            onClick={() => { onClickCreateSharedAlbum?.(); setMobileOpen(false); }}
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
  );

  return (
    <>
      {/* 데스크톱 사이드바 */}
      <aside
        className={[
          "group relative hidden border-r border-[#E8EDF4] bg-white lg:flex lg:h-[calc(100vh-72px)] lg:flex-col",
          isCollapsed ? "lg:w-[72px]" : "lg:w-[240px]",
        ].join(" ")}
      >
        <SidebarCollapseButton isCollapsed={isCollapsed} onClick={onToggleCollapse} />
        {sidebarContent}
      </aside>

      {/* 모바일 하단 탭바 */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 flex h-14 items-center justify-around border-t border-[#E8EDF4] bg-white">
        <button
          type="button"
          onClick={() => { onClickMyAlbum?.(myAlbums[0]?.id); }}
          className={[
            "flex flex-1 flex-col items-center justify-center gap-0.5 h-full text-xs font-medium transition-colors",
            activeMyAlbumId != null && activeSharedAlbumId == null
              ? "text-[#2563EB]"
              : "text-[#94A3B8]",
          ].join(" ")}
        >
          <BookOpen size={20} strokeWidth={2} />
          <span>내 앨범</span>
        </button>

        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className={[
            "flex flex-1 flex-col items-center justify-center gap-0.5 h-full text-xs font-medium transition-colors",
            activeSharedAlbumId != null ? "text-[#2563EB]" : "text-[#94A3B8]",
          ].join(" ")}
        >
          <Users size={20} strokeWidth={2} />
          <span>공유 앨범</span>
        </button>
      </div>

      {/* 모바일 드로어 */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex flex-col">
          {/* 배경 딤 */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileOpen(false)}
          />
          {/* 패널 */}
          <div className="absolute bottom-0 left-0 right-0 max-h-[70vh] rounded-t-2xl bg-white shadow-xl flex flex-col">
            <div className="flex items-center justify-between border-b border-[#E8EDF4] px-5 py-4">
              <span className="text-sm font-bold text-[#1E293B]">앨범 선택</span>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="flex h-7 w-7 items-center justify-center rounded-full text-[#94A3B8] hover:bg-[#F1F5F9]"
              >
                <X size={16} />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 px-3 py-3">
              <SidebarSection title="내 앨범" isCollapsed={false}>
                {myAlbums.map((album) => (
                  <SidebarAlbumItem
                    key={album.id}
                    label={album.name}
                    isActive={album.id === activeMyAlbumId}
                    isCollapsed={false}
                    onClick={() => { onClickMyAlbum?.(album.id); setMobileOpen(false); }}
                  />
                ))}
              </SidebarSection>
              <div className="my-3 border-t border-[#EEF2F7]" />
              <SidebarSection title="공유 앨범" isCollapsed={false}>
                {sharedAlbums.length > 0 ? (
                  sharedAlbums.map((album) => (
                    <SidebarFriendItem
                      key={album.id}
                      label={album.name}
                      isActive={album.id === activeSharedAlbumId}
                      isCollapsed={false}
                      onClick={() => { onClickSharedAlbum?.(album.id); setMobileOpen(false); }}
                      onClickRename={() => { onClickSharedAlbumRename?.(album.id); setMobileOpen(false); }}
                      onClickLeave={() => { onClickSharedAlbumLeave?.(album.id); setMobileOpen(false); }}
                    />
                  ))
                ) : (
                  <div className="rounded-xl bg-[#F8FAFC] px-4 py-4 text-sm leading-6 text-[#94A3B8]">
                    아직 공유 앨범이 없습니다.
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => { onClickCreateSharedAlbum?.(); setMobileOpen(false); }}
                  className="mt-2 flex h-11 w-full items-center gap-3 rounded-2xl border border-dashed border-[#BFDBFE] bg-[#F8FBFF] px-4 text-sm font-semibold text-[#2563EB] transition-colors hover:bg-[#F0F7FF]"
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#E8F1FF]">
                    <Plus size={14} strokeWidth={2.5} />
                  </span>
                  공유 앨범 만들기
                </button>
              </SidebarSection>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
