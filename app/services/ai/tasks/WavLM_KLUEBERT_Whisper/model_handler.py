import asyncio
import os
import torch
import numpy as np
import torch.nn.functional as F
from typing import Any, Dict, List
from pathlib import Path
from transformers import pipeline, AutoTokenizer, Wav2Vec2FeatureExtractor

from app.services.ai.base import BaseAIModel
from .emotion_model import OptimizedCrossAttentionModel

class SubtitleModel(BaseAIModel[str, List[Dict[str, Any]]]):
    """
    영상에서 음성을 추출하여 텍스트(STT)와 감정 데이터를 생성하는 싱글톤 AI 모델입니다.
    """
    _instance = None
    _is_initialized = False

    def __new__(cls):
        # 파이썬 특성상 멀티스레드 동시 초기화가 발생할 수 있으나, 
        # 단일 FastAPI 프로세스 로딩 시점에서 순차적 처리가 예상되어 Lock은 생략합니다.
        if cls._instance is None:
            cls._instance = super(SubtitleModel, cls).__new__(cls)
        return cls._instance

    def __init__(self):
        # 이미 로딩이 완료된 경우 스킵 (싱글톤)
        if self._is_initialized:
            return
            
        print("[SubtitleModel] 모델 초기화 시작... (최초 1회만 메모리 적재)")
        
        # 1. GPU 디바이스 설정 (사용자 코드 수정: GPU 0번 할당)
        os.environ["CUDA_VISIBLE_DEVICES"] = "0"
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        print(f"[SubtitleModel] 사용 디바이스: {self.device}")
        
        self.id2label = {
            0: "Angry (분노)", 1: "Disgust (혐오)", 2: "Fear (불안)", 
            3: "Happy (행복)", 4: "Neutral (중립)", 5: "Sad (슬픔)", 6: "Surprise (당황)"
        }
        
        # 2. Whisper 모델 로드
        print("[SubtitleModel] Whisper 모델 (음성 인식) 로딩 중...")
        self.whisper_pipe = pipeline(
            "automatic-speech-recognition", 
            model="openai/whisper-medium", 
            device=self.device
        )
        
        # 3. 토크나이저 & 프로세서 로드
        print("[SubtitleModel] 음성/텍스트 프로세서 & 토크나이저 로딩 중...")
        self.processor = Wav2Vec2FeatureExtractor.from_pretrained("microsoft/wavlm-base")
        self.tokenizer = AutoTokenizer.from_pretrained("klue/bert-base")          

        # 4. 감정 인식 모델 초기화 및 가중치 이식
        print("[SubtitleModel] 감정 인식 모델 껍데기 세팅 및 가중치 삽입 중...")
        self.emotion_model = OptimizedCrossAttentionModel(n_labels=7) 
        
        model_dir = Path(__file__).parent / "model"
        safetensors_path = model_dir / "model.safetensors"
        bin_path = model_dir / "pytorch_model.bin"
        
        try:
            if safetensors_path.exists():
                from safetensors.torch import load_file
                self.emotion_model.load_state_dict(load_file(str(safetensors_path)))
                print(f"[SubtitleModel] {safetensors_path.name} 로드 성공!")
            elif bin_path.exists():
                self.emotion_model.load_state_dict(torch.load(str(bin_path), map_location=self.device))
                print(f"[SubtitleModel] {bin_path.name} 로드 성공!")
            else:
                print(f"[WARNING] 모델 가중치 파일이 없습니다: {model_dir} 내부를 확인하세요.")
                print(f"[WARNING] 임시 가중치(Random)로 일단 동작합니다. (정확도 보장 안 됨)")
        except Exception as e:
            print(f"[ERROR] 모델 가중치 로드 실패: {str(e)}")
            
        self.emotion_model.to(self.device)
        self.emotion_model.eval() # 추론 모드 전환
        
        self._is_initialized = True
        print("[SubtitleModel] 초기화 완벽히 완료되었습니다.")

    def _sync_predict(self, audio_array: np.ndarray) -> List[Dict[str, Any]]:
        """
        [동기/Blocking 연산]
        실제 CPU/GPU를 점유하여 모델을 구동하는 핵심 로직입니다.
        이 함수가 이벤트 루프 안에서 그냥 돌면 모든 API 요청이 먹통이 됩니다.

        Args:
            audio_array: AudioService에서 추출된 float32 NumPy 배열 (16000Hz 모노)
        """
        print("[SubtitleModel] 실제 추론 시작 (STT & Emotion)")

        # 1. 텍스트 추출 (STT) - AudioService에서 추출된 float32 배열을 바로 사용
        transcription = self.whisper_pipe(
            {"array": audio_array, "sampling_rate": 16000},
            generate_kwargs={"language": "korean"}
        )
        text_input = transcription["text"].strip()
        print(f"  > [STT 결과]: {text_input}")

        # 2. 데이터 전처리 - 동일한 audio_array를 감정 분석 전처리에도 재사용
        audio_inputs = self.processor(audio_array, sampling_rate=16000, return_tensors="pt", return_attention_mask=True)
        text_inputs = self.tokenizer(text_input, return_tensors="pt", padding=True, truncation=True, max_length=48)

        # 3. 모델 프레딕션
        with torch.no_grad():
            outputs = self.emotion_model(
                input_values=audio_inputs.input_values.to(self.device),
                audio_mask=audio_inputs.attention_mask.to(self.device),
                input_ids=text_inputs.input_ids.to(self.device),
                text_mask=text_inputs.attention_mask.to(self.device)
            )
            
            logits = outputs["logits"]
            probs = F.softmax(logits, dim=-1)
            pred_idx = torch.argmax(probs, dim=-1).item()
            pred_prob = probs[0][pred_idx].item() * 100

            # 7개 감정 전체 확률 포맷팅 (소수점 둘째 자리)
            all_emotions = {
                self.id2label[i]: round(probs[0][i].item() * 100, 2)
                for i in range(len(self.id2label))
            }

        duration = max(len(audio_array) / 16000.0, 1.0)
        
        print(f"  > [감정 분류 결과]: {self.id2label[pred_idx]} ({pred_prob:.1f}%)")
        return [
            {
                "start": 0.0,
                "end": round(duration, 1),
                "text": text_input,
                "emotion": self.id2label[pred_idx],
                "confidence": round(pred_prob, 2),
                "emotions": all_emotions
            }
        ]

    async def predict(self, audio_array: np.ndarray) -> List[Dict[str, Any]]:
        """
        비동기 논블로킹(Non-Blocking) 실행 래핑.
        AudioService에서 추출된 NumPy 배열을 Thread Pool에서 처리합니다.
        """
        print("[SubtitleModel] 비동기 추론을 위해 Thread Pool로 넘깁니다")
        return await asyncio.to_thread(self._sync_predict, audio_array)


class VibrationModel(BaseAIModel[str, List[Dict[str, Any]]]):
    """
    영상에서 음성 진동 데이터를 생성하는 AI 모델 (현재는 임시 시뮬레이션입니다.)
    """
    async def predict(self, audio_array: np.ndarray) -> List[Dict[str, Any]]:
        print("[VibrationModel] Processing audio array")
        await asyncio.sleep(1)
        return [
            {"timestamp": 0.5, "intensity": 0.8},
            {"timestamp": 3.2, "intensity": 0.6},
        ]
