// 메인 페이지 사이드바 더미 데이터 파일
import type { MyAlbumItem, SharedAlbumItem } from "../types/sidebar";

export const MY_ALBUMS: MyAlbumItem[] = [
  {
    id: 1,
    name: "내 앨범",
    isActive: true,
  },
];

export const SHARED_ALBUMS: SharedAlbumItem[] = [
  { id: 101, name: "김지은" },
  { id: 102, name: "박준호" },
];