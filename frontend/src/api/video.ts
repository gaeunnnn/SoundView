// 영상 관련 API 함수를 모아두는 파일

import { apiClient } from "./client";

export type UpdatedVideo = {
  videoId: number;
  title: string;
};

// POST /api/videos/{videoId} — 영상 제목 수정
export const updateVideoTitle = (videoId: number, title: string): Promise<UpdatedVideo> =>
  apiClient.post<UpdatedVideo>(`/api/videos/${videoId}`, { title }).then((res) => res.data);
