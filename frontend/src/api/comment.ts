// 댓글 관련 API 함수를 모아두는 파일

import { apiClient } from "./client";

export type CommentItem = {
  commentId: number;
  content: string;
  userNickname: string;
  createdAt: string;
};

// GET /api/videos/{videoId}/comments — 특정 영상 댓글 목록 조회
export const getComments = (videoId: number): Promise<CommentItem[]> =>
  apiClient.get<CommentItem[]>(`/api/videos/${videoId}/comments`).then((res) => res.data);

// POST /api/videos/{videoId}/comments — 댓글 작성
export const addComment = (videoId: number, content: string): Promise<CommentItem> =>
  apiClient.post<CommentItem>(`/api/videos/${videoId}/comments`, { content }).then((res) => res.data);

// DELETE /api/comments/{commentId} — 댓글 삭제
export const deleteComment = (commentId: number): Promise<void> =>
  apiClient.delete(`/api/comments/${commentId}`).then(() => {});
