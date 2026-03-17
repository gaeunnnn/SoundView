// 앨범-영상 관계 관련 API 함수를 모아두는 파일

import { apiClient } from "./client";

// DELETE /api/album-videos/{albumVideoId} — 공유 앨범에서 영상 제거 (영상 자체는 삭제되지 않음)
export const removeAlbumVideo = (albumVideoId: number): Promise<void> =>
  apiClient.delete(`/api/album-videos/${albumVideoId}`).then(() => undefined);
