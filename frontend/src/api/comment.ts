// 댓글 관련 API 함수를 모아두는 파일

import { apiClient } from "./client";

export type CommentItem = {
  commentId: number;
  content: string;
  userNickname: string;
  createdAt: string;
};

// POST /api/videos/{videoId}/comments — 댓글 작성 (videoId는 album_videos.id)
export const addComment = (videoId: number, content: string): Promise<CommentItem> =>
  apiClient.post<CommentItem>(`/api/videos/${videoId}/comments`, { content }).then((res) => res.data);

// DELETE /api/comments/{commentId} — 자신이 작성한 댓글 삭제
export const deleteComment = (commentId: number): Promise<void> =>
  apiClient.delete(`/api/comments/${commentId}`).then(() => {});
