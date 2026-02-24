1. 프로젝트 개요
목표: 사용자가 입력한 텍스트의 감정을 분석하여 다마고치의 표정(기쁨, 슬픔, 화남, 평온)을 변화시키는 AI 모델 구축

모델: beomi/KcELECTRA-base (한국어 구어체 및 신조어에 특화된 모델)

데이터셋: 약 20,000개의 문장으로 구성된 감정 분류 데이터 (tamagotchi_dataset.csv)

2. 주요 학습 과정
데이터 전처리 (Preprocessing)
레이블 매핑: 텍스트 형태의 감정을 모델이 이해할 수 있는 숫자(0: 기쁨, 1: 슬픔, 2: 화남, 3: 평온)로 변환

데이터 분할: 전체 데이터를 8:2(Train:Test) 비율로 나누어 학습과 검증을 동시에 진행

토크나이징: KcELECTRA 전용 토크나이저를 사용하여 문장을 최대 64토큰 길이로 수치화(Vectorization)

모델 학습 (Training)
Framework: Hugging Face Trainer API 사용

Hyperparameters:

Epochs: 3 (전체 데이터를 3번 반복 학습)

Batch Size: 16

Optimizer: AdamW (기본 설정)

Evaluation: 매 에포크 종료 시마다 정확도(Accuracy) 측정

MLflow
도입 이유: 모델의 버전 관리 및 하이퍼파라미터 변화에 따른 성능(Loss, Accuracy) 비교를 체계화하기 위함

기능: report_to="mlflow" 설정을 통해 학습 로그를 실시간으로 대시보드에 기록

3. 기술적 이슈 및 해결 (Troubleshooting)
Issue 1: 생성 모델과 분류 모델의 혼동
현상: 모델 출력 시 외계어(깨진 글자)가 발생함

원인: 문장을 만드는 '생성형(Causal LM)' 방식과 감정을 맞히는 '분류형(Sequence Classification)' 방식을 혼용함

해결: AutoModelForSequenceClassification을 사용하여 모델의 목적을 분류로 명확히 설정하고 logits 값을 통해 감정 인덱스를 추출하도록 수정

Issue 2: MLflow 설치 에러 (subprocess-exited-with-error)
원인: 코랩 환경의 pip 버전과 MLflow 의존성 패키지 간의 충돌

해결: pip install --upgrade pip setuptools wheel을 통해 패키지 관리 도구를 먼저 최신화한 후 재설치하여 해결