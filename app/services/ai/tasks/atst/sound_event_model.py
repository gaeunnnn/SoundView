"""
ATST-F 기반 환경음 분류 모델.

Demucs로 분리된 no_vocals(배경음) numpy 배열을 입력받아
시간대별 환경음 이벤트를 한국어 자막 형태로 반환합니다.

핵심 추론/후처리 로직은 동일 디렉토리의 atst_engine.py에 위임합니다.
"""

import os
import sys
import asyncio
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional

import numpy as np
import torch

from app.services.ai.base import BaseAIModel

logger = logging.getLogger(__name__)

# ── 경로 상수 ──────────────────────────────────────────────────────────
# 이 파일이 위치한 디렉토리 (app/services/ai/tasks/atst/)
_ATST_DIR = Path(__file__).resolve().parent

# atst_engine.py를 일반 모듈로 import하기 위해 경로 등록
_atst_dir_str = str(_ATST_DIR)
if _atst_dir_str not in sys.path:
    sys.path.insert(0, _atst_dir_str)

# PretrainedSED 경로 (pip install -e 되어 있으면 불필요하지만, fallback용)
_PRETRAINED_SED_ROOT = _ATST_DIR / "PretrainedSED"

# 체크포인트 파일 경로
_CHECKPOINT_PATH = _PRETRAINED_SED_ROOT / "resources" / "ATST-F_strong_1.pt"

# JSON 설정 파일 경로
_LABEL_TRANSLATION_PATH = _ATST_DIR / "atst_label_translations.ko.json"
_CAPTION_LABEL_PATH = _ATST_DIR / "atst_label_ko.json"
_POSTPROCESS_CONFIG_PATH = _ATST_DIR / "atstf_environment_postprocess.sample.json"


def _import_atst_engine():
    """
    atst_engine 모듈을 동적으로 import합니다.
    파일명에 하이픈이 없으므로 일반 import 가능합니다.
    """
    try:
        import atst_engine
        return atst_engine
    except ImportError as e:
        logger.error(f"[SoundEventModel] atst_engine 모듈 import 실패: {e}")
        raise


class SoundEventModel(BaseAIModel[np.ndarray, List[Dict[str, Any]]]):
    """
    배경음 트랙(no_vocals)을 입력받아 환경음 이벤트를 탐지하는 모델.

    ATST-F 엔진의 정교한 추론/후처리 파이프라인을 래핑합니다:
    - 겹치는 청크 + center-weighted 집계
    - 2-pass 탐지 (기본 + transient)
    - hysteresis 기반 이벤트 경계 안정화
    - 같은 자막 병합, 반복 소리 그룹핑, 최소 길이 필터
    - JSON 설정 파일 기반 한국어 자막 레이블 시스템
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

        logger.info("[SoundEventModel] ATST-F 엔진 기반 초기화 시작...")
        self.engine = None
        self.model = None
        self.class_labels = None
        self.device = None

        try:
            engine = _import_atst_engine()
            self.engine = engine

            # PretrainedSED 모듈 import 준비
            engine.prepare_pretrainedsed_import(_PRETRAINED_SED_ROOT)

            # 장치 결정
            self.device = engine.resolve_device("auto")
            logger.info(f"[SoundEventModel] 추론 장치: {self.device}")

            # CUDA 최적화
            if self.device.type == "cuda" and hasattr(torch.backends, "cudnn"):
                torch.backends.cudnn.benchmark = True

            # 모델 빌드 (체크포인트 로드 포함)
            self.model, self.class_labels, resolved_ckpt = engine.build_model(
                pretrainedsed_root=_PRETRAINED_SED_ROOT,
                checkpoint_name="ATST-F_strong_1",
                checkpoint_path=_CHECKPOINT_PATH if _CHECKPOINT_PATH.exists() else None,
                resources_dir=_PRETRAINED_SED_ROOT / "resources",
                device=self.device,
            )
            logger.info(f"[SoundEventModel] ATST-F 체크포인트 로드 완료: {resolved_ckpt}")

            # JSON 설정 파일 로드
            self.postprocess_config = engine.load_postprocess_config(
                _POSTPROCESS_CONFIG_PATH if _POSTPROCESS_CONFIG_PATH.exists() else None
            )
            self.label_translations = engine.load_label_translation_map(
                _LABEL_TRANSLATION_PATH if _LABEL_TRANSLATION_PATH.exists() else None
            )
            self.caption_label_overrides = engine.load_label_translation_map(
                _CAPTION_LABEL_PATH if _CAPTION_LABEL_PATH.exists() else None
            )

            # 후처리 파라미터 머지
            self.label_thresholds = dict(self.postprocess_config.get("label_thresholds", {}))
            self.label_min_peak = dict(self.postprocess_config.get("label_min_peak", {}))
            self.label_min_mean = dict(self.postprocess_config.get("label_min_mean", {}))
            self.label_min_duration = dict(self.postprocess_config.get("label_min_duration", {}))

            # AMP 사용 여부
            self.use_amp = engine.should_use_amp(self.device, disable_amp=False)

            logger.info("[SoundEventModel] 초기화 완료.")

        except Exception as e:
            logger.error(f"[SoundEventModel] 초기화 실패: {e}", exc_info=True)
            self.model = None

        self._is_initialized = True

    def _build_excluded_labels(self) -> set:
        """제외할 라벨 목록 생성 (범용 라벨 + 사람 목소리)."""
        excluded = set(self.postprocess_config.get("exclude_labels", []))
        excluded.update(self.engine.GENERIC_ENVIRONMENT_LABELS)
        excluded.update(self.engine.HUMAN_VOICE_LABELS)
        excluded.add(self.engine.COLLAPSED_HUMAN_VOICE_LABEL)
        return excluded

    def _sync_predict(self, audio_array: np.ndarray) -> List[Dict[str, Any]]:
        """
        동기 추론 메서드. atst_engine의 함수들을 순서대로 호출합니다.

        파이프라인:
        1. 오디오 전처리 (mono, float32 보정)
        2. 겹치는 청크 추론 → 프레임 logits
        3. sigmoid → 확률 변환
        4. caption label 단위 확률 뷰 생성
        5. 2-pass 이벤트 탐지 (기본 + transient)
        6. 이벤트 병합 + dip 분할 + 대표 라벨 할당
        7. 자막 후처리 (같은 자막 병합, 반복 그룹핑, 짧은 자막 제거)
        8. 결과 변환
        """
        if self.model is None or self.engine is None:
            logger.warning("[SoundEventModel] 모델 미초기화 상태, 빈 결과 반환")
            return []

        engine = self.engine

        try:
            # ── 1. 오디오 전처리 ──
            if audio_array.ndim > 1:
                audio_array = audio_array.mean(axis=1)
            audio_array = audio_array.astype(np.float32, copy=False)

            if audio_array.size == 0:
                logger.warning("[SoundEventModel] 빈 오디오 입력")
                return []

            audio_duration = float(audio_array.shape[0] / engine.DEFAULT_SAMPLE_RATE)

            # ── 2. 겹치는 청크 추론 ──
            logits, frame_resolution = engine.run_chunked_inference(
                model=self.model,
                waveform=audio_array,
                chunk_seconds=engine.DEFAULT_CHUNK_SECONDS,
                chunk_hop_seconds=engine.DEFAULT_CHUNK_HOP_SECONDS,
                device=self.device,
                batch_size=0,  # 자동 결정
                chunk_aggregation=engine.DEFAULT_CHUNK_AGGREGATION,
                use_amp=self.use_amp,
            )

            # ── 3. 확률 변환 ──
            probabilities = engine.sigmoid_probabilities(logits)
            excluded_labels = self._build_excluded_labels()

            # ── 4~6. caption label 단위 탐지 ──
            if self.caption_label_overrides:
                events = self._detect_with_caption_view(
                    engine, probabilities, frame_resolution, audio_duration, excluded_labels
                )
            else:
                events = self._detect_with_raw_labels(
                    engine, probabilities, frame_resolution, audio_duration, excluded_labels
                )

            # ── 7. 자막 후처리 ──
            subtitle_events = engine.build_subtitle_events(
                events,
                translations=self.label_translations,
                caption_overrides=self.caption_label_overrides,
            )
            processed_subtitle_events = engine.subtitle_postprocess(
                subtitle_events,
                default_merge_gap=engine.DEFAULT_SUBTITLE_MERGE_GAP,
                default_min_duration=engine.DEFAULT_SUBTITLE_MIN_DURATION,
            )
            # 자막 후처리 결과를 DetectedEvent로 변환
            final_events = engine.subtitle_events_to_detected_events(processed_subtitle_events)

            # ── 8. 결과 변환 (기존 인터페이스 호환) ──
            results = []
            for event in final_events:
                caption_label = event.caption_label_override or engine.resolve_caption_label(
                    event.event_label, self.label_translations, self.caption_label_overrides
                )
                label_ko = engine.resolve_label_translation(
                    event.event_label, self.label_translations
                )

                results.append({
                    "start": round(event.onset, 2),
                    "end": round(event.offset, 2),
                    "event": caption_label,
                    "event_en": event.event_label,
                    "label_ko": label_ko,
                    "caption_label": caption_label,
                    "duration": round(event.duration, 2),
                    "max_confidence": round(event.max_confidence, 4),
                    "mean_confidence": round(event.mean_confidence, 4),
                })

            logger.info(f"[SoundEventModel] 탐지 완료: {len(results)}개 이벤트, 오디오 {audio_duration:.1f}초")
            return results

        except Exception as e:
            logger.error(f"[SoundEventModel] 추론 에러: {e}", exc_info=True)
            return []

    def _detect_with_caption_view(
        self, engine, probabilities, frame_resolution: float,
        audio_duration: float, excluded_labels: set,
    ) -> list:
        """
        caption label 단위로 확률을 재그룹화하여 이벤트를 탐지합니다.
        같은 자막 문구로 매핑되는 여러 raw label의 확률을 통합하여
        더 안정적인 탐지 결과를 생성합니다.
        """
        caption_probabilities, caption_labels, caption_to_raw_labels = engine.build_caption_probability_view(
            probabilities=probabilities,
            labels=self.class_labels,
            translations=self.label_translations,
            caption_overrides=self.caption_label_overrides,
            excluded_labels=excluded_labels,
        )

        if not caption_labels:
            return []

        # raw label override를 caption 단위로 변환
        caption_thresholds = engine.project_label_value_overrides_to_captions(
            caption_to_raw_labels, self.label_thresholds
        )
        caption_min_peak = engine.project_label_value_overrides_to_captions(
            caption_to_raw_labels, self.label_min_peak
        )
        caption_min_mean = engine.project_label_value_overrides_to_captions(
            caption_to_raw_labels, self.label_min_mean
        )
        caption_min_duration = engine.project_label_value_overrides_to_captions(
            caption_to_raw_labels, self.label_min_duration
        )

        # 기본 pass
        primary_events = engine.detect_events_with_pass(
            probabilities=caption_probabilities,
            labels=caption_labels,
            frame_resolution=frame_resolution,
            audio_duration=audio_duration,
            threshold=engine.DEFAULT_THRESHOLD,
            release_threshold_ratio=engine.DEFAULT_RELEASE_THRESHOLD_RATIO,
            median_window=engine.DEFAULT_MEDIAN_WINDOW,
            min_event_duration=engine.DEFAULT_MIN_EVENT_DURATION,
            min_event_peak=engine.DEFAULT_MIN_EVENT_PEAK,
            min_event_mean=engine.DEFAULT_MIN_EVENT_MEAN,
            label_thresholds=caption_thresholds,
            label_min_peak=caption_min_peak,
            label_min_mean=caption_min_mean,
            label_min_duration=caption_min_duration,
        )

        # transient pass (짧은 충격음 보조 탐지)
        transient_events = engine.detect_events_with_pass(
            probabilities=caption_probabilities,
            labels=caption_labels,
            frame_resolution=frame_resolution,
            audio_duration=audio_duration,
            threshold=engine.DEFAULT_TRANSIENT_THRESHOLD,
            release_threshold_ratio=engine.DEFAULT_RELEASE_THRESHOLD_RATIO,
            median_window=engine.DEFAULT_TRANSIENT_MEDIAN_WINDOW,
            min_event_duration=engine.DEFAULT_TRANSIENT_MIN_EVENT_DURATION,
            min_event_peak=engine.DEFAULT_TRANSIENT_MIN_EVENT_PEAK,
            min_event_mean=engine.DEFAULT_TRANSIENT_MIN_EVENT_MEAN,
            label_thresholds=caption_thresholds,
            label_min_peak=caption_min_peak,
            label_min_mean=caption_min_mean,
            label_min_duration=caption_min_duration,
        )

        # 두 pass 결과 합치기
        events = engine.combine_event_lists(primary_events, transient_events)
        events = engine.merge_adjacent_events(events, engine.DEFAULT_MERGE_GAP)

        # 내부 dip 분할
        events = engine.split_events_on_internal_dips(
            events=events,
            score_probabilities=caption_probabilities,
            labels=caption_labels,
            base_threshold=engine.DEFAULT_THRESHOLD,
            frame_resolution=frame_resolution,
            audio_duration=audio_duration,
            min_event_duration=engine.DEFAULT_MIN_EVENT_DURATION,
        )
        events = engine.merge_adjacent_events(events, engine.DEFAULT_MERGE_GAP)

        # 대표 raw label 할당
        events = engine.assign_representative_raw_labels(
            caption_events=events,
            caption_to_raw_labels=caption_to_raw_labels,
            raw_labels=self.class_labels,
            raw_probabilities=probabilities,
            frame_resolution=frame_resolution,
        )

        return events

    def _detect_with_raw_labels(
        self, engine, probabilities, frame_resolution: float,
        audio_duration: float, excluded_labels: set,
    ) -> list:
        """
        caption override가 없는 경우, raw label 기준으로 이벤트를 탐지합니다.
        """
        primary_events = engine.detect_events_with_pass(
            probabilities=probabilities,
            labels=self.class_labels,
            frame_resolution=frame_resolution,
            audio_duration=audio_duration,
            threshold=engine.DEFAULT_THRESHOLD,
            release_threshold_ratio=engine.DEFAULT_RELEASE_THRESHOLD_RATIO,
            median_window=engine.DEFAULT_MEDIAN_WINDOW,
            min_event_duration=engine.DEFAULT_MIN_EVENT_DURATION,
            min_event_peak=engine.DEFAULT_MIN_EVENT_PEAK,
            min_event_mean=engine.DEFAULT_MIN_EVENT_MEAN,
            label_thresholds=self.label_thresholds,
            label_min_peak=self.label_min_peak,
            label_min_mean=self.label_min_mean,
            label_min_duration=self.label_min_duration,
        )

        # transient pass
        transient_events = engine.detect_events_with_pass(
            probabilities=probabilities,
            labels=self.class_labels,
            frame_resolution=frame_resolution,
            audio_duration=audio_duration,
            threshold=engine.DEFAULT_TRANSIENT_THRESHOLD,
            release_threshold_ratio=engine.DEFAULT_RELEASE_THRESHOLD_RATIO,
            median_window=engine.DEFAULT_TRANSIENT_MEDIAN_WINDOW,
            min_event_duration=engine.DEFAULT_TRANSIENT_MIN_EVENT_DURATION,
            min_event_peak=engine.DEFAULT_TRANSIENT_MIN_EVENT_PEAK,
            min_event_mean=engine.DEFAULT_TRANSIENT_MIN_EVENT_MEAN,
            label_thresholds=self.label_thresholds,
            label_min_peak=self.label_min_peak,
            label_min_mean=self.label_min_mean,
            label_min_duration=self.label_min_duration,
        )

        events = engine.combine_event_lists(primary_events, transient_events)
        events = engine.merge_adjacent_events(events, engine.DEFAULT_MERGE_GAP)
        events = engine.filter_excluded_events(events, excluded_labels)
        events = engine.filter_caption_mapped_events(events, self.caption_label_overrides)
        events = engine.merge_events_by_caption_label(
            events,
            translations=self.label_translations,
            caption_overrides=self.caption_label_overrides,
            merge_gap=engine.DEFAULT_MERGE_GAP,
        )

        return events

    async def predict(self, input_data: np.ndarray) -> List[Dict[str, Any]]:
        """비동기 추론 인터페이스. 블로킹 추론을 별도 스레드에서 실행합니다."""
        return await asyncio.to_thread(self._sync_predict, input_data)
