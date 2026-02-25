## 1️⃣ ROPE (Rotary Positional Embedding)

### 🔹 기존 Position Encoding 문제
- 절대 위치 기반
- 위치마다 고정 벡터 사용
- 문장 길어질수록 일반화 어려움

### 🔹 ROPE 핵심
- 위치 정보를 **회전 변환 (sin, cos)** 으로 표현
- 절대 위치가 아닌 **상대적 위치 정보 반영**
- 단어 간 거리 정보 학습 가능

### ✅ 장점
- 긴 문맥에서도 안정적
- Attention 성능 향상
- 최신 LLM에서 기본적으로 사용됨

---

## 2️⃣ KV Cache

### 🔹 문제
- 토큰 생성 시 이전 토큰을 매번 재계산
- 추론 속도 느림

### 🔹 해결 방식
- 이전 토큰의 **Key / Value 저장**
- 새 토큰의 Query만 계산

### ✅ 효과
- 추론 속도 대폭 향상
- 긴 context 처리 가능
- GPT 계열 모델 필수 기술

---

## 3️⃣ LoRA (Low-Rank Adaptation)

### 🔹 문제
- 전체 LLM fine-tuning 비용 매우 큼

### 🔹 핵심 아이디어
- 기존 Weight는 고정
- 작은 Rank 행렬 A, B만 학습


### ✅ 장점
- 학습 파라미터 감소
- 메모리 절약
- 빠른 fine-tuning 가능

---

## 4️⃣ P-tuning

### 기존 Prompt 문제
- 사람이 직접 설계
- 최적화 어려움

### P-tuning 방식
- 학습 가능한 pseudo prompt embedding 사용
- 모델은 freeze 상태 유지

### 특징
- 적은 파라미터로 task 적응
- 효율적인 프롬프트 학습

