// 메인 페이지 사이드바에 사용하는 타입 정의 파일
export type MyAlbumItem = {
  id: number;
  name: string;
  isActive?: boolean;
};

export type SharedAlbumItem = {
  id: number;
  name: string;
};

export type MainSidebarProps = {
  myAlbums: MyAlbumItem[];
  sharedAlbums: SharedAlbumItem[];
  activeMyAlbumId?: number;
  activeSharedAlbumId?: number;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onClickMyAlbum?: (albumId: number) => void;
  onClickSharedAlbum?: (albumId: number) => void;
  onClickSharedAlbumSettings?: (albumId: number) => void;
  onClickSharedAlbumRename?: (albumId: number) => void;
  onClickSharedAlbumLeave?: (albumId: number) => void;
  onClickCreateSharedAlbum?: () => void;
};