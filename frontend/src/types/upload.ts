// S3 멀티파트 업로드 관련 타입 정의

// POST /api/videos/upload/initiate 요청 바디
export type InitiateUploadRequest = {
  title: string;
  fileName: string;
  partCount: number;
};

// POST /api/videos/upload/initiate 응답 바디
export type InitiateUploadResponse = {
  videoId: number;
  uploadId: string;
  videoS3Key: string;
  presignedUrls: string[];
};

// complete 요청의 parts 항목 (명세 기준 camelCase 유지)
export type UploadPart = {
  partNumber: number;
  eTag: string;
};

// POST /api/videos/upload/complete 요청 바디
export type CompleteUploadRequest = {
  videoId: number;
  uploadId: string;
  parts: UploadPart[];
};
