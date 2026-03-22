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


export type CreateAlbumRequest = {
  name: string;
  memberCodes: string[] | null;
};

export type CreateAlbumResponse = {
  albumId: number;
  name: string;
  ownerId: number;
  memberCount: number;
};

// POST /api/albums — 공유 앨범 생성 및 멤버 초대
export const createAlbum = (body: CreateAlbumRequest): Promise<CreateAlbumResponse> =>
  apiClient.post<CreateAlbumResponse>("/api/albums", body).then((res) => res.data);


export type LeaveAlbumResponse = {
  message: string;
};

// DELETE /api/albums/{albumId}/leave — 공유 앨범 나가기
export const leaveAlbum = (albumId: number): Promise<LeaveAlbumResponse> =>
  apiClient.delete<LeaveAlbumResponse>(`/api/albums/${albumId}/leave`).then((res) => res.data);


export type UpdatedAlbum = {
  albumId: number;
  name: string;
};

// PATCH /api/albums/{albumId} — 공유 앨범 이름 수정
export const editAlbumTitle = (albumId: number, newTitle: string): Promise<UpdatedAlbum> =>
  apiClient.patch<UpdatedAlbum>(`/api/albums/${albumId}`, { name: newTitle }).then((res) => res.data);


export type AlbumMember = {
  userId: number;
  nickname: string;
  userCode: string;
  profileImageUrl: string | null;
  isMe: boolean;
};

// GET /api/albums/{albumId}/users — 공유 앨범 멤버 목록 조회
export const getAlbumMembers = (albumId: number): Promise<AlbumMember[]> =>
  apiClient.get<AlbumMember[]>(`/api/albums/${albumId}/users`).then((res) => res.data);


export type AlbumVideoCount = {
  videoCount: number;
};

// GET /api/albums/{albumId}/video-count — 앨범에 포함된 영상 개수 조회
export const getAlbumVideoCount = (albumId: number): Promise<AlbumVideoCount> =>
  apiClient.get<AlbumVideoCount>(`/api/albums/${albumId}/video-count`).then((res) => res.data);


export type AlbumVideo = {
  albumVideoId: number;
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


export type AddVideosToAlbumResponse = {
  albumVideoIds: number[];
};

// POST /api/albums/{albumId}/videos — 공유 앨범에 영상 추가
export const addVideosToAlbum = (albumId: number, videoIds: number[]): Promise<AddVideosToAlbumResponse> =>
  apiClient.post<AddVideosToAlbumResponse>(`/api/albums/${albumId}/videos`, { videoIds }).then((res) => res.data);


export type MyAlbumVideo = {
  videoId: number;
  title: string;
  thumbnailUrl: string | null;
  durationSec: number | null;
  createdAt: string;
};

// GET /api/albums/{albumId}/videos/my — 앨범 내 내가 업로드한 영상 목록 조회
export const getMyAlbumVideos = (albumId: number): Promise<MyAlbumVideo[]> =>
  apiClient.get<MyAlbumVideo[]>(`/api/albums/${albumId}/videos/my`).then((res) => res.data);
