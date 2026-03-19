import httpx
import os
from pathlib import Path
from tempfile import NamedTemporaryFile
from typing import Any, Dict
from app.core.config import settings


class StorageService:
    """
    MinIO와의 파일 입출력을 담당하는 서비스 클래스입니다.
    AI 모델과 무관하게 영상 다운로드, 결과 업로드, 임시 파일 정리를 수행합니다.
    """

    async def download_video(self, video_url: str) -> str:
        """
        주어진 URL에서 영상을 다운로드하고 로컬 임시 경로를 반환합니다.
        """
        print(f"Downloading video from: {video_url}")

        # 확장자 유지하여 임시 파일 생성
        suffix = Path(video_url).suffix or ".mp4"
        temp_file = NamedTemporaryFile(delete=False, suffix=suffix)
        temp_path = temp_file.name      # 경로 미리 저장

        # 타임아웃 설정(대용량 파일 다운로드 고려)
        timeout = httpx.Timeout(60.0, read=300.0)

        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                # 메모리 관리를 위해 stream 방식으로 다운로드 요청
                async with client.stream("GET", video_url) as response:
                    response.raise_for_status()  # 200 OK가 아니면 예외 발생

                    # 스트림 데이터를 8KB 청크 단위로 디스크에 기록
                    async for chunk in response.aiter_bytes(chunk_size=8192):
                        temp_file.write(chunk)

            temp_file.close()

            # 파일 용량 검증(0바이트 or 지나치게 작은 깨진 파일 필터링)
            file_size = os.path.getsize(temp_path)
            
            if file_size < 1024:
                raise ValueError(f"다운로드한 파일이 너무 작습니다: {file_size} bytes")

            print(f"[StorageService] 영상 다운로드 완료 (저장 경로: {temp_path})")

            return temp_path

        except httpx.HTTPError as e:
            temp_file.close()
            self.cleanup(temp_path)
            raise RuntimeError(f"S3 다운로드 중 HTTP 네트워크 오류 발생: {str(e)}")
        except Exception as e:
            temp_file.close()
            self.cleanup(temp_path)
            raise Exception(f"영상 다운로드 실패: {str(e)}")

    async def upload_results(self, video_id: str, subtitle_result: list, vibration_result: list, sound_event_result: list) -> tuple[str, str, str]:
        """
        처리 결과(자막, 진동, 효과음) JSON을 각각 MinIO에 업로드하고 접근 URL 튜플을 반환합니다.
        """
        print(f"Uploading results for video {video_id} to MinIO...")

        # 실제 운영: boto3 또는 minio 라이브러리 사용
        # bucket = "results"
        # minio_client.put_object(...)

        # 시뮬레이션
        subtitle_url = f"http://{settings.MINIO_ENDPOINT}/results/{video_id}_subtitle.json"
        vibration_url = f"http://{settings.MINIO_ENDPOINT}/results/{video_id}_vibration.json"
        sound_event_url = f"http://{settings.MINIO_ENDPOINT}/results/{video_id}_sound_event.json"
        
        return subtitle_url, vibration_url, sound_event_url


    def cleanup(self, file_path: str) -> None:
        """
        사용이 끝난 임시 파일을 삭제합니다.
        """
        if os.path.exists(file_path):
            os.unlink(file_path)
            print(f"Cleaned up temporary file: {file_path}")
