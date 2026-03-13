# 🚀 FastAPI AI Server

MinIO 영상을 입력받아 자막 및 진동 데이터를 생성하는 AI 추론 서버입니다. 비동기 처리, 관심사 분리(SoC), Pydantic V2 타입 검증을 기반으로 설계되었습니다.

## 📂 프로젝트 구조

```text
app/
├── api/                     # 🌐 라우팅 레이어 (HTTP 요청/응답만 담당)
│   └── v1/
│       ├── api.py           # v1 라우터 통합
│       └── endpoints/
│           └── health.py    # 시스템 헬스체크
├── core/                    # ⚙️ 전역 설정
│   └── config.py            # pydantic-settings 기반 환경 변수 관리
├── models/                  # 💾 DB ORM 모델 (추후 추가)
├── schemas/                 # 🛡️ Pydantic 검증 스키마 (추후 추가)
├── services/                # 🧠 비즈니스 로직 레이어
│   ├── video_service.py     # 파이프라인 오케스트레이션 (진입점)
│   ├── storage_service.py   # MinIO 영상 다운로드 / 결과 업로드 / 파일 정리
│   ├── callback_service.py  # Spring Boot 완료 콜백 (HTTP PUT)
│   └── ai/                  # 🤖 AI 추론 전용 레이어
│       ├── base.py          # BaseAIModel / BasePipeline 추상 인터페이스
│       ├── common/          # 범용 AI 유틸리티 (공통 수학 연산 등)
│       └── tasks/
│           └── video_processing/
│               └── model_handler.py  # SubtitleModel / VibrationModel
└── main.py                  # 🚀 FastAPI 앱 진입점
```

## 🔄 처리 흐름

```
영상 URL 수신
  → [StorageService] MinIO에서 영상 다운로드
  → [SubtitleModel + VibrationModel] AI 추론 (병렬 실행)
  → [StorageService] 결과 JSON MinIO 업로드
  → [CallbackService] Spring Boot 완료 콜백 (PUT /videos/{id}/complete)
  → 임시 파일 정리
```

> 두 AI 모델은 `asyncio.gather()`로 **병렬 실행**됩니다. 하나라도 실패하면 전체가 실패합니다.

## 🏗️ 서비스 레이어 역할

| 파일 | 역할 | AI 모델 교체 시 변경? |
|---|---|---|
| `video_service.py` | 파이프라인 흐름 제어 | ❌ |
| `storage_service.py` | MinIO 파일 I/O | ❌ |
| `callback_service.py` | Spring Boot HTTP 통신 | ❌ |
| `model_handler.py` | AI 추론 (자막 / 진동) | ✅ **여기만** |

## 🛠️ 기술 스택

| 항목 | 버전 |
|---|---|
| Python | 3.9+ |
| FastAPI | 0.128.8 |
| Pydantic V2 | 2.12.5 |
| pydantic-settings | 2.11.0 |
| httpx | 0.28.1 |
| Uvicorn | 0.39.0 |

## 🚀 시작하기

### 1. 가상환경 활성화 및 의존성 설치
```bash
conda activate soundpjt
pip install -r requirements.txt
```

### 2. 환경 변수 설정
프로젝트 루트에 `.env` 파일을 생성하여 아래 항목을 설정합니다.
```env
MINIO_ENDPOINT=localhost:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
SPRING_BOOT_API_URL=http://localhost:8080
```

### 3. 서버 실행
```bash
uvicorn app.main:app --reload
```
실행 후 [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)에서 Swagger UI를 확인할 수 있습니다.

---
> [!NOTE]
> 이 프로젝트는 **Workspace Rules**(`FastAPI AI Server` 컨벤션)에 의해 관리됩니다.
