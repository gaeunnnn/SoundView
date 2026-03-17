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


export type AlbumVideo = {
  videoId: number;
  title: string;
  thumbnailUrl: string | null;
  durationSec: number | null;
  uploaderName: string;
  commentCount: number;
  reactionCount: number;
  createdAt: string;
};

// GET /api/albums/{albumId}/videos — 특정 앨범에 포함된 영상 목록 조회
export const getAlbumVideos = (albumId: number): Promise<AlbumVideo[]> =>
  apiClient.get<AlbumVideo[]>(`/api/albums/${albumId}/videos`).then((res) => res.data);


export type UpdatedAlbum = {
  albumId: number;
  name: string;
};

export type AlbumVideoCount = {
  videoCount: number;
};

// GET /api/albums/{albumId}/video-count — 앨범에 포함된 영상 개수 조회
export const getAlbumVideoCount = (albumId: number): Promise<AlbumVideoCount> =>
  apiClient.get<AlbumVideoCount>(`/api/albums/${albumId}/video-count`).then((res) => res.data);


// PATCH /api/albums/{albumId} — 공유 앨범 이름 수정
export const editAlbumTitle = (albumId: number, newTitle: string): Promise<UpdatedAlbum> =>
  apiClient.patch<UpdatedAlbum>(`/api/albums/${albumId}`, { name: newTitle }).then((res) => res.data);