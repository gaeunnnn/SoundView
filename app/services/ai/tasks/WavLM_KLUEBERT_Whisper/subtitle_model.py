import asyncio
import os
import torch
import numpy as np
import torch.nn.functional as F
from typing import Any, Dict, List
from pathlib import Path
from transformers import AutoTokenizer, Wav2Vec2FeatureExtractor
from faster_whisper import WhisperModel

from app.services.ai.base import BaseAIModel
from .emotion_model import OptimizedCrossAttentionModel


class SubtitleModel(BaseAIModel[str, List[Dict[str, Any]]]):
    """
    목소리 트랙(vocal_array)을 입력받아 문장(한마디) 단위로 STT 후
    각 구간의 감정을 분류하는 싱글톤 AI 모델입니다.

    입력: VoiceSeparator.separate()의 'vocals' 배열 (float32, 16000Hz, 모노)
    출력: [{"start", "end", "text", "emotion", "confidence", "emotions"}, ...]
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

        # 1. GPU 디바이스 설정
        os.environ["CUDA_VISIBLE_DEVICES"] = "0"
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        print(f"[SubtitleModel] 사용 디바이스: {self.device}")

        self.id2label = {
            0: "Angry (분노)", 1: "Disgust (혐오)", 2: "Fear (불안)",
            3: "Happy (행복)", 4: "Neutral (중립)", 5: "Sad (슬픔)", 6: "Surprise (당황)"
        }

        # 2. Faster-Whisper 모델 로드 (STT)
        print("[SubtitleModel] Faster-Whisper 모델 (음성 인식) 로딩 중...")
        # device는 "cuda" 또는 "cpu" 문자열로 지정, compute_type은 fp16(GPU) 또는 int8(CPU/GPU)
        compute_type = "float16" if torch.cuda.is_available() else "int8"
        self.whisper_model = WhisperModel("medium", device=self.device.type, compute_type=compute_type)

        # 3. 토크나이저 & 프로세서 로드
        print("[SubtitleModel] 음성/텍스트 프로세서 & 토크나이저 로딩 중...")
        self.processor = Wav2Vec2FeatureExtractor.from_pretrained("microsoft/wavlm-base")
        self.tokenizer = AutoTokenizer.from_pretrained("klue/bert-base")

        # 4. 감정 인식 모델 초기화 및 가중치 로드
        print("[SubtitleModel] 감정 인식 모델 껍데기 세팅 및 가중치 삽입 중...")
        self.emotion_model = OptimizedCrossAttentionModel(n_labels=7)

        model_dir = Path(__file__).parent / "model"
        safetensors_path = model_dir / "model.safetensors"
        bin_path = model_dir / "pytorch_model.bin"

        try:
            if safetensors_path.exists():
                from safetensors.torch import load_file
                self.emotion_model.load_state_dict(load_file(str(safetensors_path)), strict=False)
                print(f"[SubtitleModel] {safetensors_path.name} 로드 성공!")
            elif bin_path.exists():
                self.emotion_model.load_state_dict(
                    torch.load(str(bin_path), map_location=self.device), strict=False
                )
                print(f"[SubtitleModel] {bin_path.name} 로드 성공!")
            else:
                print(f"[WARNING] 모델 가중치 파일이 없습니다: {model_dir}")
                print(f"[WARNING] 임시 가중치(Random)로 동작합니다. (정확도 보장 안 됨)")
        except Exception as e:
            print(f"[ERROR] 모델 가중치 로드 실패: {str(e)}")

        self.emotion_model.to(self.device)
        self.emotion_model.eval()  # 추론 모드 전환

        self._is_initialized = True
        print("[SubtitleModel] 초기화 완료.")

    # 세그먼트 최소 길이(1초): 이보다 짧으면 WavLM 입력 부족으로 분류가 불안정합니다.
    MIN_SEGMENT_SEC: float = 1.0

    def _predict_emotion_for_segment(
        self,
        segment_audio: np.ndarray,
        text: str
    ) -> Dict[str, Any]:
        """
        하나의 음성 세그먼트와 해당 텍스트로 감정 분류를 수행합니다.
        """
        audio_inputs = self.processor(
            segment_audio, sampling_rate=16000,
            return_tensors="pt", return_attention_mask=True
        )
        text_inputs = self.tokenizer(
            text, return_tensors="pt",
            padding=True, truncation=True, max_length=48
        )

        with torch.no_grad():
            outputs = self.emotion_model(
                input_values=audio_inputs.input_values.to(self.device),
                audio_mask=audio_inputs.attention_mask.to(self.device),
                input_ids=text_inputs.input_ids.to(self.device),
                text_mask=text_inputs.attention_mask.to(self.device)
            )
            probs = F.softmax(outputs["logits"], dim=-1)
            pred_idx = torch.argmax(probs, dim=-1).item()
            pred_prob = probs[0][pred_idx].item() * 100
            all_emotions = {
                self.id2label[i]: round(probs[0][i].item() * 100, 2)
                for i in range(len(self.id2label))
            }

        return {
            "emotion": self.id2label[pred_idx],
            "confidence": round(pred_prob, 2),
            "emotions": all_emotions,
        }

    def _sync_predict(self, vocal_array: np.ndarray) -> List[Dict[str, Any]]:
        """
        [동기/Blocking 연산]
        Whisper로 문장(한마디) 단위로 분리한 뒤,
        각 세그먼트의 목소리+텍스트로 개별 감정 분류를 수행합니다.

        Args:
            vocal_array: VoiceSeparator에서 분리된 목소리 배열 (float32, 16000Hz, 모노)
        """
        print("[SubtitleModel] 추론 시작 (STT & Emotion per segment)")

        # 1. Faster-Whisper STT - VAD 필터를 적용하여 무음 구간을 명확히 제거
        # vocal_array의 데이터를 그대로 인식시키되, vad_filter=True를 통해 실제 음성이 있는 구간의 타임스탬프를 획득
        segments_generator, info = self.whisper_model.transcribe(
            vocal_array,
            language="ko",
            vad_filter=False,            # Silero VAD로 앞뒤 침묵 제거
            vad_parameters=dict(min_silence_duration_ms=500) # 0.5초 이상 침묵이면 분리
        )
        
        chunks = []
        for segment in segments_generator:
            chunks.append({
                "timestamp": (segment.start, segment.end),
                "text": segment.text
            })
            
        print(f"  > [STT 결과]: {len(chunks)}개 문장 세그먼트 감지 (Faster-Whisper + VAD)")

        # 2. 너무 짧은 세그먼트는 이전 구간에 병합
        merged: List[Dict] = []
        for chunk in chunks:
            start, end = chunk["timestamp"]
            text = chunk["text"].strip()
            if start is None:
                start = merged[-1]["end"] if merged else 0.0
            if end is None:
                end = len(vocal_array) / 16000.0

            if merged and (end - start) < self.MIN_SEGMENT_SEC:
                merged[-1]["end"] = end
                merged[-1]["text"] += " " + text
            else:
                merged.append({"start": start, "end": end, "text": text})

        # 3. 각 세그먼트에 감정 분류
        results: List[Dict[str, Any]] = []
        for seg in merged:
            start, end, text = seg["start"], seg["end"], seg["text"]
            print(f"  > 분석 중: [{start:.1f}s ~ {end:.1f}s] \"{text}\"")

            seg_audio = vocal_array[int(start * 16000): int(end * 16000)]
            emotion_result = self._predict_emotion_for_segment(seg_audio, text)
            print(f"    → {emotion_result['emotion']} ({emotion_result['confidence']:.1f}%)")

            results.append({
                "start": round(start, 2),
                "end": round(end, 2),
                "text": text,
                **emotion_result,
            })

        return results

    async def predict(self, vocal_array: np.ndarray) -> List[Dict[str, Any]]:
        """
        비동기 논블로킹 실행 래핑.
        VoiceSeparator에서 분리된 목소리 트랙(vocal_array)을 Thread Pool에서 처리합니다.
        """
        print("[SubtitleModel] 비동기 추론을 위해 Thread Pool로 넘깁니다")
        return await asyncio.to_thread(self._sync_predict, vocal_array)
