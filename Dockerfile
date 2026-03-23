# 1. 파이썬 베이스 이미지 (3.9 버전 고정)
FROM python:3.9-slim

# 2. 작업 디렉토리 설정
WORKDIR /code

# 3. ⭐️ 오디오 도구 + 패키지 빌드용 C++ 컴파일러 추가 설치
RUN apt-get update && apt-get install -y \
    ffmpeg \
    libsndfile1 \
    build-essential \
    python3-dev \
    && rm -rf /var/lib/apt/lists/*

# 4. 패키지 목록 파일 복사
COPY requirements_docker.txt .

# 5. 윈도우 GPU 호환을 위한 파이토치 및 패키지 설치
RUN pip install --no-cache-dir -r requirements_docker.txt --extra-index-url https://download.pytorch.org/whl/cu121

# 6. 전체 소스 코드 복사
COPY . .

# 7. FastAPI 포트 노출 및 실행 명령어
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]