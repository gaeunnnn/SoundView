// S3 멀티파트 업로드 유틸리티 함수 모음
//
// 주의: S3 버킷의 CORS 설정에서 ExposeHeaders에 "ETag"가 포함되어야
// 브라우저에서 응답 헤더의 ETag 값을 읽을 수 있습니다.
// 미설정 시 response.headers.get("ETag")가 null을 반환하여 업로드가 실패합니다.

import { initiateMultipartUpload, completeMultipartUpload } from "../api/upload";
import type { UploadPart } from "../types/upload";

// S3 멀티파트 업로드 규격상 마지막 파트를 제외한 각 파트의 최소 크기
const MIN_CHUNK_SIZE = 5 * 1024 * 1024; // 5MB

// 파일 크기에 따라 청크 크기를 계산합니다.
// 마지막 파트를 제외한 모든 파트가 S3 최소 파트 크기(5MB) 이상이 되도록 보장합니다.
// S3 최대 파트 수(10,000개) 초과 방지: 파일이 클수록 청크 크기를 키웁니다.
export function calculateChunkSize(fileSize: number): number {
  const PREFERRED_CHUNK_SIZE = 10 * 1024 * 1024; // 기본 선호 크기: 10MB
  // 파일 크기 / 10,000 이상이어야 파트 수 제한을 초과하지 않음
  const minForMaxParts = Math.ceil(fileSize / 10000);
  return Math.max(MIN_CHUNK_SIZE, PREFERRED_CHUNK_SIZE, minForMaxParts);
}

// 파일을 지정된 크기의 Blob 청크 배열로 분할합니다.
// 마지막 청크는 chunkSize보다 작을 수 있습니다.
export function splitFileIntoChunks(file: File, chunkSize: number): Blob[] {
  const chunks: Blob[] = [];
  let start = 0;
  while (start < file.size) {
    chunks.push(file.slice(start, start + chunkSize));
    start += chunkSize;
  }
  return chunks;
}

// S3 presigned URL로 단일 파트를 PUT 업로드하고 ETag를 반환합니다.
//
// presigned URL 요청 시 주의사항:
// - 백엔드 인증 헤더(쿠키 등)를 포함하지 않습니다.
//   presigned URL 자체에 AWS 서명 정보가 포함되어 있기 때문입니다.
// - S3 CORS 설정에서 ExposeHeaders: ["ETag"]가 필요합니다.
export async function uploadPartToS3(
  presignedUrl: string,
  chunk: Blob,
  partNumber: number
): Promise<string> {
  const response = await fetch(presignedUrl, {
    method: "PUT",
    body: chunk,
    // credentials 미지정: S3에 쿠키/인증 헤더를 전송하지 않음
  });

  if (!response.ok) {
    throw new Error(
      `파트 ${partNumber} S3 업로드 실패: HTTP ${response.status} ${response.statusText}`
    );
  }

  // S3 응답 헤더에서 ETag 추출
  // S3는 ETag를 따옴표로 감싸서 반환합니다. 예: "82b7844a62a3cc9bf60ad941c069beb4"
  const rawETag = response.headers.get("ETag");
  if (!rawETag) {
    throw new Error(
      `파트 ${partNumber}의 ETag를 응답 헤더에서 읽을 수 없습니다. ` +
        "S3 버킷 CORS 설정의 ExposeHeaders에 ETag가 포함되어 있는지 확인하세요."
    );
  }

  // 따옴표 제거 후 반환: "82b7844a..." -> 82b7844a...
  return rawETag.replace(/"/g, "");
}

// S3 멀티파트 업로드 전체 흐름을 조율하는 함수
//
// 처리 단계:
//   1. 파일 분할
//   2. 백엔드 initiate API 호출 (세션 생성 및 presigned URL 발급)
//   3. 모든 파트를 S3에 병렬 업로드
//   4. parts를 partNumber 오름차순 정렬
//   5. 백엔드 complete API 호출 (S3 파일 병합 명령)
//
// onProgress: 업로드 진행률 콜백 (0-100 정수)
//   - 파트 업로드 완료마다 0-90% 범위로 보고
//   - complete API 성공 시 100% 보고
export async function uploadVideoMultipart(
  file: File,
  title: string,
  onProgress?: (progress: number) => void
): Promise<void> {
  // 1단계: 청크 크기 계산 및 파일 분할
  const chunkSize = calculateChunkSize(file.size);
  const chunks = splitFileIntoChunks(file, chunkSize);
  const partCount = chunks.length;

  // 2단계: 백엔드에 멀티파트 업로드 세션 생성 요청
  let initiateResult;
  try {
    initiateResult = await initiateMultipartUpload({
      title,
      fileName: file.name,
      partCount,
    });
  } catch (error) {
    throw new Error(
      `업로드 시작(initiate) 실패: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  const { videoId, uploadId, presignedUrls } = initiateResult;

  // presigned URL 개수와 분할된 청크 개수가 일치하는지 검증
  if (presignedUrls.length !== chunks.length) {
    throw new Error(
      `presignedUrls 개수(${presignedUrls.length})와 청크 개수(${chunks.length})가 일치하지 않습니다.`
    );
  }

  // 3단계: 모든 파트를 S3에 병렬 업로드
  // 각 파트 완료 시 진행률을 0-90% 범위로 보고합니다.
  onProgress?.(0);
  let completedCount = 0;

  const partUploadPromises = chunks.map(
    (chunk, index): Promise<UploadPart> =>
      uploadPartToS3(presignedUrls[index], chunk, index + 1).then((eTag) => {
        completedCount += 1;
        onProgress?.(Math.floor((completedCount / partCount) * 90));
        return { partNumber: index + 1, eTag };
      })
  );

  let parts: UploadPart[];
  try {
    // 모든 파트 업로드가 끝날 때까지 대기
    parts = await Promise.all(partUploadPromises);
  } catch (error) {
    // TODO: abort API가 추가되면 여기서 멀티파트 업로드 중단 요청 필요
    // 현재는 S3에 불완전한 멀티파트 업로드가 남을 수 있습니다.
    throw new Error(
      `파트 업로드 실패: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  // 4단계: parts를 partNumber 오름차순 정렬
  // 병렬 업로드 완료 순서가 무작위일 수 있으므로 complete 호출 전에 반드시 정렬합니다.
  parts.sort((a, b) => a.partNumber - b.partNumber);

  // 5단계: 백엔드에 업로드 완료 알림 및 S3 파일 병합 요청
  try {
    await completeMultipartUpload({ videoId, uploadId, parts });
  } catch (error) {
    throw new Error(
      `업로드 완료(complete) 실패: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  onProgress?.(100);
}
