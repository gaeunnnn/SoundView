import json
import httpx
import os
import logging
import aioboto3
from botocore.exceptions import ClientError
from pathlib import Path
from tempfile import NamedTemporaryFile
from typing import Any, Dict
from app.core.config import settings


logger = logging.getLogger(__name__)


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
        temp_file.close()

        # AWS 설정값 가지고오기
        bucket = settings.AWS_S3_BUCKET_NAME
        enpoint = settings.AWS_S3_ENDPOINT
        actual_endpoint = enpoint if enpoint else None
        session = aioboto3.Session()

        try:
            async with session.client(
                's3',
                endpoint_url=actual_endpoint,
                aws_access_key_id=settings.AWS_S3_ACCESS_KEY,
                aws_secret_access_key=settings.AWS_S3_SECRET_KEY,
                region_name=settings.AWS_REGION
            ) as s3:

                # aioboto3가 내부적으로 메모리 최적화 및 멀티파트 다운로드를 알아서 수행
                await s3.download_file(bucket, video_url, temp_path)

            file_size = os.path.getsize(temp_path)

            if file_size < 1024:
                raise ValueError(f"다운로드한 파일이 너무 작습니다: {file_size} bytes")

            logger.info(f"[StorageService] 영상 다운로드 완료 (저장 경로: {temp_path})")
            
            return temp_path

        except ClientError as e:
            self.cleanup(temp_path)
            logger.error(f"[StorageService] S3 접근 권한 거부 또는 에러 발생(IAM 키 확인 필요): {e}")
            raise RuntimeError(f"S3 파일 다운로드 실패 (403/404): {e}")
        except Exception as e:
            self.cleanup(temp_path)
            logger.error(f"[StorageService] 영상 다운로드 중 알 수 없는 에러 발생: {e}")
            raise Exception(f"영상 다운로드 실패: {str(e)}")


    async def upload_results(self, video_id: str, subtitle_result: list, vibration_result: list, sound_event_result: list) -> tuple[str, str, str]:
        """
        처리 결과(자막, 진동, 효과음) JSON을 각각 MinIO에 업로드하고 접근 URL 튜플을 반환합니다.
        """

        # 테스트용 코드, 임시 url을 반환함.
        logger.info(f"[StorageService] 테스트용 임시 비디오 {video_id}의 자막 파일 업로드 시작")
        # Spring Boot로 넘겨줄 S3 Object Key (URL 전체가 아닌 Key만 넘기는 것이 정석입니다)
        subtitle_key = f"results/{video_id}_subtitle.json"
        vibration_key = f"results/{video_id}_vibration.json"
        sound_event_key = f"results/{video_id}_sound_event.json"
        logger.info(f"[StorageService] 가짜(Mock) S3 업로드 완료 처리: {subtitle_key}")
        
        # 실제 URL이 아닌 Object Key를 튜플로 반환
        return subtitle_key, vibration_key, sound_event_key


        # 실제로 서비스하는 코드, S3에 데이터를 저장함.
        #==================================================
        logger.info(f"[StorageService] 비디오 {video_id}의 자막 파일 업로드 시작")

        bucket = settings.AWS_S3_BUCKET_NAME
        endpoint = settings.AWS_S3_ENDPOINT

        upload_tasks = {
            f"results/{video_id}_subtitle.json": subtitle_result,
            f"results/{video_id}_vibration.json": vibration_result,
            f"results/{video_id}_sound_event.json": sound_event_result
        }

        uploaded_urls = []
        session = aioboto3.Session()

        try:
            # S3 클라이언트 세션 비동기 연결
            async with session.client(
                's3',
                endpoint_url=endpoint,
                aws_access_key_id=settings.AWS_S3_ACCESS_KEY,
                aws_secret_access_key=settings.AWS_S3_SECRET_KEY
            ) as s3:

                # 매핑된 3개의 파일(자막, 진동, 효과음)을 순차적으로 업로드
                for object_key, data in upload_tasks.items():
                    # 리스트/딕셔너리 데이터를 JSON 문자열로 변환 후 UTF-8 바이트로 인코딩 (한글 깨짐 방지)
                    json_body = json.dumps(data, ensure_ascii=False).encode('utf-8')

                    # 로컬에 임시 파일을 만들지 안고 메모리에서 S3 버킷으로 직접 전송
                    await s3.put_object(
                        Bucket=bucket,
                        Key=object_key,
                        Body=json_body,
                        ContentType='application/json'
                    )

                    # 반환할 URL 조립
                    file_url = f"{endpoint}/{bucket}/{object_key}"
                    uploaded_urls.append(file_url)

                    logger.info(f"[StorageService] S3/MinIO 업로드 완료: {object_key}")
        
            return tuple(uploaded_urls)
        
        except ClientError as e:
            logger.error(f"[StorageService] S3/MinIO 업로드 중 AWS 클라이언트 에러 발생: {e}")
            raise RuntimeError(f"결과 업로드 실패 (ClientError): {e}")
        except Exception as e:
            logger.error(f"[StorageService] S3/MinIO 업로드 중 알 수 없는 에러 발생: {e}")
            raise RuntimeError(f"결과 업로드 실패: {e}")


    def cleanup(self, file_path: str) -> None:
        """
        사용이 끝난 임시 파일을 삭제합니다.
        """
        if os.path.exists(file_path):
            os.unlink(file_path)
            print(f"Cleaned up temporary file: {file_path}")
