# 🚀 FastAPI AI Server (Sound Event, Subtitle & Vibration)

MinIO 영상을 입력받아 **자막(STT/감정), 진동 데이터, 효과음 분류** 데이터를 생성하는 고성능 AI 추론 서버입니다. 비동기 처리, 관심사 분리(SoC), 인공지능 모델의 병렬 실행을 기반으로 설계되었습니다.

## 📂 프로젝트 구조

```text
app/
├── api/                     # 🌐 라우팅 레이어 (HTTP 요청/응답 담당)
│   └── v1/
│       └── endpoints/
│           └── health.py    # 시스템 헬스체크
├── core/                    # ⚙️ 전역 설정 (pydantic-settings)
├── services/                # 🧠 비즈니스 로직 레이어
│   ├── video_service.py     # 🚀 파이프라인 오케스트레이션 (메인 진입점)
│   ├── storage_service.py   # 💾 MinIO I/O (다운로드/결과 업로드)
│   ├── audio_service.py     # 🔉 오디오 추출 (FFmpeg 파이프)
│   ├── callback_service.py  # 📞 Spring Boot 완료 알림 (HTTP)
│   └── ai/                  # 🤖 AI 추론 전용 레이어
│       ├── common/          # ✂️ VoiceSeparator (Demucs 음성/배경분리)
│       └── tasks/
│           ├── WavLM_KLUEBERT_Whisper/ # 🗣️ 자막 및 진동 생성
│           │   ├── subtitle_model.py  # Faster-Whisper + Emotion
│           │   └── vibration_model.py # 진동 세기 분석
│           └── atst/                   # 🎆 배경음(효과음) 분류
│               ├── sound_event_model.py # ATST-F SOTA 모델 래퍼
│               └── PretrainedSED/      # 모델 소스코드 (서브모듈/클론)
└── main.py                  # 🚀 FastAPI 메인 앱
```

## 🔄 처리 흐름 (3-Way Parallel Engine)

1.  **영상 수신**: MinIO URL을 통해 영상 처리 요청 수신.
2.  **전처리**:
    *   `AudioService`: 영상에서 오디오 추출.
    *   `VoiceSeparator`: **목소리(Vocals)**와 **배경음(No Vocals)**을 AI로 분리.
3.  **AI 병렬 추론 (`asyncio.gather`)**:
    *   **자막 모델**: 원본 오디오를 사용하여 STT 및 7개 감정 분석 수행.
    *   **진동 모델**: 분리된 목소리 트랙을 기반으로 햅틱 진동 데이터 생성.
    *   **효과음 모델**: 분리된 배경음 트랙 내의 사운드 이벤트(불꽃놀이, 사이렌 등)를 텍스트 및 이모지로 분류.
4.  **후처리**:
    *   3종 JSON 결과물을 MinIO에 업로드.
    *   Spring Boot 서버에 3개의 결과 URL을 포함하여 완료 콜백 전송.

## 🏗️ 서비스 레이어 역할

| 파일 | 역할 | 핵심 기술 |
|---|---|---|
| `video_service.py` | 전체 워크플로우 제어 | asyncio |
| `subtitle_model.py` | 자막 및 감정 추출 | Faster-Whisper, WavLM, KLUE-BERT |
| `vibration_model.py` | 진동 신호 생성 | Signal Processing (Mocking) |
| `sound_event_model.py` | 배경 효과음 분류 | ATST-F (AudioSet SOTA) |
| `voice_separator.py` | 음원 분리 (MR 제거) | Facebook Demucs (htdemucs) |

## 🛠️ 기술 스택 및 환경

- **Core**: Python 3.9+, FastAPI, Pydantic V2
- **AI/ML**: PyTorch, Faster-Whisper, Demucs, Timm, Torchaudio
- **Media**: Librosa, FFmpeg-python, Scipy

## 🚀 시작하기

### 1. 환경 준비
```bash
conda activate soundpjt
# 가상환경에 필요한 패키지 설치
pip install -r requirements.txt
# AI 필수 추가 패키지 (환경에 따라 조절)
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu118
pip install librosa demucs timm einops
```

### 2. 가중치 설정 (ATST-F)
`app/services/ai/tasks/atst/PretrainedSED` 저장소가 클론되어 있어야 하며, 최초 실행 시 `resources/` 폴더에 가중치 파일이 자동 다운로드됩니다.

### 3. 서버 실행
```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

---
> [!IMPORTANT]
> 이 프로젝트는 고사양 GPU(NVIDIA CUDA 지원) 환경에서 최적의 성능을 발휘합니다.
