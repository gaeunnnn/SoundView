// 앨범 관련 API 함수를 모아두는 파일

import { apiClient } from "./client";

export type Album = {
  albumId: number;
  name: string;
  ownerId: number;
  ownerName: string;
  memberCount: number;
  owner: boolean;
};

// GET /api/albums — 로그인한 사용자가 속한 모든 앨범(내 앨범 및 공유 앨범) 목록 조회
export const getAlbums = (): Promise<Album[]> =>
  apiClient.get<Album[]>("/api/albums").then((res) => res.data);
