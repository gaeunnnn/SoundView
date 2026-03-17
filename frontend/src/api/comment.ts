// 댓글 관련 API 함수를 모아두는 파일

import { apiClient } from "./client";

export type Comment = {
  commentId: number;
  content: string;
  userNickname: string;
  createdAt: string;
};

// GET /api/videos/{videoId}/comments — 특정 영상의 댓글 목록 조회 (videoId는 album_videos.id)
export const getVideoComments = (videoId: number): Promise<Comment[]> =>
  apiClient.get<Comment[]>(`/api/videos/${videoId}/comments`).then((res) => res.data);

// POST /api/videos/{videoId}/comments — 특정 영상에 댓글 작성 (videoId는 album_videos.id)
export const postVideoComment = (videoId: number, content: string): Promise<Comment> =>
  apiClient.post<Comment>(`/api/videos/${videoId}/comments`, { content }).then((res) => res.data);

// DELETE /api/comments/{commentId} — 자신이 작성한 댓글 삭제
export const deleteComment = (commentId: number): Promise<void> =>
  apiClient.delete(`/api/comments/${commentId}`).then(() => {});
