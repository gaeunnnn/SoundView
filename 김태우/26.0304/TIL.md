Whisper와 RoBERTa를 결합한 음성 감정 분석 시스템 구현
1. 학습 개요
음성 파일(.wav)로부터 텍스트를 추출(STT)하고, 추출된 텍스트의 문장별 감정을 분류하는 파이프라인을 구축했다. OpenAI의 Whisper 모델과 Hugging Face의 RoBERTa 기반 한국어 감정 분류 모델을 활용하였다.

2. 주요 기술 스택
OpenAI Whisper: 다양한 언어와 오디오 조건에서 학습된 범용 음성 인식 모델.

Hugging Face Transformers: 사전 학습된 RoBERTa 모델을 사용하여 한국어 문장의 감정을 분류.

Tkinter: 사용자로부터 파일을 선택받기 위한 GUI 라이브러리.

PyTorch: 모델 추론 및 텐서 연산 처리.

3. 핵심 코드 분석
3.1 파일 선택 시스템 (GUI)
tkinter를 활용하여 CLI 환경에서도 사용자가 직접 탐색기를 통해 파일을 선택할 수 있도록 구현했다.

root.withdraw(): 메인 윈도우 창을 숨김 처리.

filetypes=[("WAV files", "*.wav")]: 분석 대상을 WAV 파일로 제한.

3.2 Whisper 모델을 통한 음성 인식 (STT)
whisper.load_model("medium")을 사용하여 음성을 텍스트로 변환했다.

language="ko": 한국어 인식으로 고정하여 정확도를 높임.

beam_size=5: 빔 서치를 통해 최적의 텍스트 결과를 도출.

segments: 전체 텍스트를 문장 단위(시간대별)로 분할하여 반환하므로 이후 문장별 감정 분석에 용이함.

3.3 RoBERTa 기반 감정 분류
Seonghaa/korean-emotion-classifier-roberta 모델을 사용하여 텍스트의 감정을 6가지 범주로 분류했다.

분류 레이블: 분노, 불안, 슬픔, 평온, 당황, 기쁨.

Softmax: 로짓(Logits) 값을 확률 값으로 변환하여 가장 높은 확률의 인덱스를 추출.

4. 코드 동작 흐름
모델 로드: Whisper와 RoBERTa 모델을 메모리에 올림.

파일 입력: 사용자가 분석할 .wav 파일을 선택.

음성 전사: Whisper가 음성을 인식하고 문장 단위(segments)로 텍스트를 생성.

감정 추론: 각 문장별로 토큰화 과정을 거쳐 RoBERTa 모델이 감정을 예측.

결과 출력: 원문 문장과 해당 문장의 감정 레이블을 매칭하여 출력.