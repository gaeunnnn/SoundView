# 🚀 FastAPI AI Server

이 프로젝트는 FastAPI를 활용하여 고성능 AI 서비스를 제공하기 위한 표준 백엔드 서버입니다. 비동기 프로그래밍, 엄격한 타입 검증, 그리고 관심사 분리(SoC) 원칙을 준수하여 설계되었습니다.

## 📂 프로젝트 구조 및 폴더 역할

프로젝트의 핵심 로직은 `app/` 디렉토리에 위치하며, 각 디렉토리는 다음과 같은 명확한 역할을 수행합니다.

```text
app/
├── api/            # 🌐 라우팅 레이어
│   └── v1/         # API 버전 관리 (v1, v2 등)
│       ├── api.py  # 엔드포인트 통합 및 라우터 등록
│       └── endpoints/ # 세부 비즈니스별 API 핸들러 (Async)
├── core/           # ⚙️ 핵심 설정
│   └── config.py   # Pydantic V2 기반 환경 변수 및 전역 설정 관리
├── models/         # 💾 데이터 레이어
│   └── (ORM)       # 데이터베이스 테이블 정의 (SQLAlchemy, Tortoise 등)
├── schemas/        # 🛡️ 검증 레이어
│   └── (Pydantic)  # Request/Response Body 데이터 구조 및 타입 검증
├── services/       # 🧠 비즈니스 로직 / AI 레이어
│   └── ai/         # AI 파이프라인 핵심
│       ├── base.py  # 모델 및 파이프라인 추상 인터페이스
│       ├── common/  # 범용 AI 유틸리티 (Resampling, Normalization 등)
│       └── tasks/   # Task 기반 파이프라인 격리 (voice_recognition, heat_map 등)
│           └── [task_name]/
│               ├── preprocessor.py  # Task 전용 데이터 전처리
│               ├── model_handler.py # AI 모델 호출/추론
│               └── postprocessor.py # Task 전용 결과 후처리
├── main.py         # 🚀 진입점 (FastAPI App 초기화 및 미들웨어 설정)
└── __init__.py     # 패키지 초기화
```

### 상세 설명
- **`api/`**: 클라이언트의 요청을 받아 적절한 서비스로 연결하는 관문입니다. 비즈니스 로직을 직접 구현하지 않고, 요청 값 전달과 응답 반환 역할에 집중합니다.
- **`core/`**: 프로젝트 전체에서 공유되는 설정 파일입니다. `.env` 파일과 연동되어 보안이 필요한 API Key 등을 타입을 보장하며 관리합니다.
- **`models/`**: 실제 데이터베이스에 저장될 데이터의 형태를 정의합니다.
- **`schemas/`**: 클라이언트와 주고받는 데이터의 인터페이스를 정의합니다. Pydantic을 사용하여 런타임에 타입 에러를 방지합니다.
- **`services/`**: 프로젝트의 심장부입니다. AI 모델의 추론(Inference) 로직이나 복잡한 데이터 가공 로직이 위치합니다.
- **`main.py`**: Uvicorn 등을 통해 서버가 시작될 때 가장 먼저 실행되는 파일입니다.

## 🛠️ 기술 스택
- **Language**: Python 3.12+
- **Framework**: FastAPI
- **Validation**: Pydantic V2
- **Config**: pydantic-settings
- **Server**: Uvicorn

## 🚀 시작하기

### 1. 의존성 설치
```bash
pip install "fastapi[all]" pydantic-settings
```

### 2. 서버 실행
```bash
uvicorn app.main:app --reload
```
실행 후 [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)에서 Swagger UI를 확인할 수 있습니다.

---
> [!NOTE]
> 이 프로젝트는 수석 개발자의 베스트 프랙티스를 따르는 **Workspace Rules**에 의해 관리되고 있습니다.
