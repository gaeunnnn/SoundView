import sys
import os
import asyncio
import numpy as np
import torch
import logging
from typing import Dict, Any, List

from app.services.ai.base import BaseAIModel

logger = logging.getLogger(__name__)

# 프로젝트 내부의 PretrainedSED 경로 동적 연결
PRETRAINED_SED_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "PretrainedSED")
if PRETRAINED_SED_PATH not in sys.path:
    sys.path.append(PRETRAINED_SED_PATH)

try:
    from data_util import audioset_classes
    from helpers.encode import ManyHotEncoder
    from models.atstframe.ATSTF_wrapper import ATSTWrapper
    from models.prediction_wrapper import PredictionsWrapper
    import scipy.ndimage
    import pandas as pd
except ImportError as e:
    logger.error(f"[SoundEventModel] PretrainedSED 모듈 로딩 실패: {e}")


class SoundEventModel(BaseAIModel[np.ndarray, List[Dict[str, Any]]]):
    """
    배경음 트랙(no_vocals)을 입력받아 어떤 종류의 소리인지 텍스트로 분류하는 모델.
    ATST-F (PretrainedSED) 아키텍처를 기반으로 AudioSet 범위의 이벤트를 탐지합니다.
    """
    _instance = None
    _is_initialized = False

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(SoundEventModel, cls).__new__(cls)
        return cls._instance

    def __init__(self):
        if self._is_initialized:
            return
            
        logger.info("[SoundEventModel] 모델 초기화 시작...")
        self.device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        
        try:
            # 1. 모델 래퍼 초기화
            atst = ATSTWrapper()
            # PredictionsWrapper 내부에서 config.RESOURCES_FOLDER를 참조함
            self.model = PredictionsWrapper(atst, checkpoint="ATST-F_strong_1")
            self.model.eval()
            self.model.to(self.device)
            logger.info("[SoundEventModel] ATST-F 가중치 로드 성공!")
        except Exception as e:
            logger.error(f"[ERROR] ATST-F 모델 가중치 로드 실패: {e}")
            self.model = None

        self.sample_rate = 16000
        self.segment_samples = 10 * self.sample_rate 
        
        # 탐지 임계값 (불꽃놀이 등 짧고 강한 소리를 위해 0.1로 하향)
        self.threshold = 0.1

        # 번역 및 이모지 매핑
        self.translation_map = {
            "Dog": "🐶 강아지 짖는 소리",
            "Bark": "🐶 강아지 짖는 소리",
            "Cat": "🐱 고양이 소리",
            "Siren": "🚨 사이렌 소리",
            "Emergency vehicle": "🚒 구급차/소방차 소리",
            "Police car (siren)": "🚓 경찰차 소리",
            "Fire engine, fire truck (siren)": "🚒 소방차 소리",
            "Music": "🎵 배경 음악",
            "Speech": "🗣️ 사람 목소리",
            "Wind": "💨 바람 소리",
            "Rain": "🌧️ 빗소리",
            "Car": "🚗 자동차 소리",
            "Vehicle": "🚗 탈것 소리",
            "Traffic noise, roadway noise": "🛣️ 도로 소음",
            "Explosion": "💥 폭발음",
            "Gunshot, gunfire": "🔫 총소리",
            "Fireworks": "🎆 불꽃놀이 소리",
            "Firecracker": "🧨 폭죽 소리",
            "Bang": "💥 쾅 소리",
            "Boom": "💣 둥 소리",
            "Bird": "🐦 새소리",
            "Bird vocalization, bird call, bird song": "🐦 새소리",
            "Water": "💧 물소리",
            "Thunder": "⚡ 천둥 소리",
            "Thunderstorm": "⚡ 천둥번개"
        }

        self._is_initialized = True
        logger.info("[SoundEventModel] 초기화 완료.")
        
    def _sync_predict(self, audio_array: np.ndarray) -> List[Dict[str, Any]]:
        if self.model is None:
            return []
            
        # 입력 오디오 모노 변환
        if audio_array.ndim > 1:
            audio_array = audio_array.mean(axis=1)

        waveform = torch.from_numpy(audio_array[None, :]).to(self.device).float()
        waveform_len = waveform.shape[1]
        audio_len = waveform_len / self.sample_rate
        
        # Encoder 설정 (AudioSet 학습 클래스 기준)
        encoder = ManyHotEncoder(audioset_classes.as_strong_train_classes, audio_len=audio_len)
        num_chunks = int(np.ceil(waveform_len / self.segment_samples))
        
        all_predictions = []
        for i in range(num_chunks):
            start_idx = i * self.segment_samples
            end_idx = min((i + 1) * self.segment_samples, waveform_len)
            waveform_chunk = waveform[:, start_idx:end_idx]
            
            # 10초 미만 청크 패딩
            if waveform_chunk.shape[1] < self.segment_samples:
                pad_size = self.segment_samples - waveform_chunk.shape[1]
                waveform_chunk = torch.nn.functional.pad(waveform_chunk, (0, pad_size))
                
            with torch.no_grad():
                mel = self.model.mel_forward(waveform_chunk)
                y_strong, _ = self.model(mel) # y_strong: [1, n_classes, n_frames]
                y_strong = torch.sigmoid(y_strong)
            all_predictions.append(y_strong.cpu())
            
        if not all_predictions:
            return []
            
        # 모든 세그먼트 합치기
        y_strong_total = torch.cat(all_predictions, dim=2)
        
        results = []
        try:
            # sed-scores-eval 배제하고 직접 디코딩
            c_scores = y_strong_total[0].numpy() # [n_classes, total_frames]
            
            # 메디안 필터로 스무딩 (9프레임 윈도우)
            c_scores_smoothed = scipy.ndimage.median_filter(c_scores, size=(1, 9))
            
            # 임계값 넘는 구간 추출
            pred_mask = c_scores_smoothed > self.threshold
            pred_list = encoder.decode_strong(pred_mask.T) # [label, onset, offset]
            
            df = pd.DataFrame(pred_list, columns=["event_label", "onset", "offset"])

            if not df.empty:
                df = df.sort_values(by="onset")
                for _, row in df.iterrows():
                    event_en = row['event_label']
                    event_ko = self.translation_map.get(event_en, f"🔊 {event_en}")
                    
                    results.append({
                        "start": round(float(row['onset']), 2),
                        "end": round(float(row['offset']), 2),
                        "event": event_ko,
                        "event_en": event_en
                    })
        except Exception as e:
            logger.error(f"[SoundEventModel] 디코딩 에러: {e}")

        return results

    async def predict(self, input_data: np.ndarray) -> List[Dict[str, Any]]:
        return await asyncio.to_thread(self._sync_predict, input_data)
