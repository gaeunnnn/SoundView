# 1. 파이썬 베이스 이미지 (화면 하단에 표시된 3.9 버전에 맞춤)
FROM python:3.9-slim

# 2. 작업 디렉토리 설정
WORKDIR /code

# 3. (중요) 오디오 처리 라이브러리를 위한 시스템 패키지 설치
# librosa나 Whisper 등을 사용하시는 것 같아 ffmpeg를 미리 설치합니다.
RUN apt-get update && apt-get install -y ffmpeg libsndfile1

# 4. 파이썬 패키지 설치
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 5. 소스 코드 복사
COPY . .

# 6. 포트 노출 및 실행 명령어 (main.py가 app 폴더 안에 있는 구조 반영)
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]