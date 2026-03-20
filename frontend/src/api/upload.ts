// S3 멀티파트 업로드 관련 백엔드 API 호출 함수
// 인증이 필요한 요청이므로 apiClient(withCredentials: true)를 사용합니다.

import { apiClient } from "./client";
import type {
  InitiateUploadRequest,
  InitiateUploadResponse,
  CompleteUploadRequest,
} from "../types/upload";

// POST /api/videos/upload/initiate
// 멀티파트 업로드 세션을 생성하고 파트별 presigned URL 리스트를 발급받습니다.
export const initiateMultipartUpload = (
  body: InitiateUploadRequest
): Promise<InitiateUploadResponse> =>
  apiClient
    .post<InitiateUploadResponse>("/api/videos/upload/initiate", body)
    .then((res) => res.data);

// POST /api/videos/upload/complete
// 모든 파트 업로드 완료 후 S3에 파일 병합을 요청합니다.
// 성공 시 응답 바디 없음 (HTTP 200)
export const completeMultipartUpload = (
  body: CompleteUploadRequest
): Promise<void> =>
  apiClient.post("/api/videos/upload/complete", body).then(() => {});

// TODO: abort API가 명세에 추가되면 아래에 구현 필요
// 현재 업로드 중단 시 S3에 불완전한 멀티파트 업로드가 남을 수 있으므로
// 백엔드에서 abort 엔드포인트를 제공해야 정상 정리가 가능합니다.
// export const abortMultipartUpload = (
//   videoId: number,
//   uploadId: string
// ): Promise<void> =>
//   apiClient.post("/api/videos/upload/abort", { videoId, uploadId }).then(() => {});
