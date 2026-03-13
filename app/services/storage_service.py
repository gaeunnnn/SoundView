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

        async with httpx.AsyncClient() as client:
            try:
                # 실제 운영: 대용량 파일 스트리밍 처리 필요
                # response = await client.get(video_url)
                # temp_file.write(response.content)

                # 시뮬레이션
                temp_file.write(b"dummy video content")
                temp_file.close()
                return temp_file.name
            except Exception as e:
                if os.path.exists(temp_file.name):
                    os.unlink(temp_file.name)
                raise Exception(f"영상 다운로드 실패: {str(e)}")

    async def upload_results(self, video_id: str, result_data: Dict[str, Any]) -> str:
        """
        처리 결과 JSON을 MinIO에 업로드하고 접근 URL을 반환합니다.
        """
        print(f"Uploading results for video {video_id} to MinIO...")

        # 실제 운영: boto3 또는 minio 라이브러리 사용
        # bucket = "results"
        # object_path = f"{video_id}_result.json"
        # minio_client.put_object(...)

        # 시뮬레이션
        json_url = f"http://{settings.MINIO_ENDPOINT}/results/{video_id}_result.json"
        return json_url

    def cleanup(self, file_path: str) -> None:
        """
        사용이 끝난 임시 파일을 삭제합니다.
        """
        if os.path.exists(file_path):
            os.unlink(file_path)
            print(f"Cleaned up temporary file: {file_path}")
