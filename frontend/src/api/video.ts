// 영상 관련 API 함수를 모아두는 파일

import { apiClient } from "./client";

export type UpdatedVideo = {
  videoId: number;
  title: string;
};

export type ReactionResponse = {
  emoji: string;
  count: number;
};

export type ReactionsResponse = {
  videoId: number;
  reactions: { emoji: string; count: number; selected: boolean }[];
};

// GET /api/videos/{videoId}/reaction — 리액션 목록 조회 (videoId는 album_videos.id)
export const getVideoReactions = (videoId: number): Promise<ReactionsResponse> =>
  apiClient.get<ReactionsResponse>(`/api/videos/${videoId}/reaction`).then((res) => res.data);

// GET /api/videos/{videoId}/status — 영상 처리 상태 조회
export const getVideoStatus = (videoId: number): Promise<{ status: string }> =>
  apiClient.get<{ status: string }>(`/api/videos/${videoId}/status`).then((res) => res.data);

// PATCH /api/videos/{videoId} — 영상 제목 수정
export const updateVideoTitle = (videoId: number, title: string): Promise<UpdatedVideo> =>
  apiClient.patch<UpdatedVideo>(`/api/videos/${videoId}`, { title }).then((res) => res.data);

// POST /api/videos/{videoId}/reaction — 이모지 리액션 추가 (videoId는 album_videos.id)
export const addVideoReaction = (videoId: number, emoji: string): Promise<ReactionResponse> =>
  apiClient.post<ReactionResponse>(`/api/videos/${videoId}/reaction`, { emoji }).then((res) => res.data);

// DELETE /api/videos/{videoId}/reaction?emoji={emoji} — 이모지 리액션 삭제 (videoId는 album_videos.id)
export const deleteVideoReaction = (videoId: number, emoji: string): Promise<void> =>
  apiClient.delete(`/api/videos/${videoId}/reaction`, { params: { emoji } }).then(() => {});

// DELETE /api/videos/{videoId} — 영상 자체 삭제 (모든 앨범에서 제거됨)
export const deleteVideo = (videoId: number): Promise<void> =>
  apiClient.delete(`/api/videos/${videoId}`).then(() => {});
