#!/usr/bin/env python
"""
ATST-F 기반 환경음 자막 생성 스크립트.

이 파일은 "환경음 wav 파일을 입력받아, 시간대별 환경음 자막 결과를 만드는"
서비스용 메인 엔진이다.

이 프로젝트에서 가정하는 전체 흐름은 아래와 같다.

1. 사용자가 영상을 업로드한다.
2. 백엔드가 영상에서 오디오를 추출한다.
3. Demucs v4로 사람 목소리와 환경음을 분리한다.
4. 분리된 "환경음 전용 wav"를 이 스크립트에 넣는다.
5. 이 스크립트가 시간대별 환경음 자막 결과를 만든다.

처음 보는 사람을 위해 이 파일이 하는 일을 아주 단순하게 풀어쓰면 아래와 같다.

1. 오디오 파일을 읽는다.
   - 입력은 보통 Demucs가 분리한 환경음 wav이다.
   - 모델이 기대하는 형식으로 맞추기 위해 16kHz, mono(1채널)로 변환한다.

2. 오디오를 모델에 넣는다.
   - 긴 오디오를 한 번에 다 넣기 어렵기 때문에 10초 정도의 조각(chunk)으로 잘라서 본다.
   - 각 조각에서 "이 순간 어떤 소리가 얼마나 강한가"를 프레임 단위로 예측한다.

3. 모델 점수를 사람이 읽을 수 있는 이벤트로 바꾼다.
   - 모델 출력은 바로 자막 문장이 아니라, 프레임별 점수 배열이다.
   - 이 점수 배열을 후처리해서 "몇 초부터 몇 초까지 어떤 소리" 형태의 이벤트로 만든다.

4. 자막 서비스용으로 한 번 더 다듬는다.
   - 같은 자막이 너무 잘게 끊기면 합치고,
   - 너무 짧아서 읽기 어려운 자막은 제거하고,
   - 개 짖는 소리 / 폭죽 소리처럼 반복되는 소리는 더 큰 자막 구간으로 묶는다.

5. 최종 자막 문구로 출력한다.
   - 모델의 원본 영문 라벨(raw label)을 그대로 쓰지 않고,
     JSON 설정 파일에 정의된 한국어 자막 문구(caption label)로 바꿔서 보여준다.
   - 결과는 터미널, JSON, CSV 형태로 저장할 수 있다.

용어 메모:
- raw label:
  모델이 직접 예측하는 원본 클래스 이름.
  예: "Fireworks"
- caption label:
  서비스 화면에 실제로 보여줄 최종 자막 문구.
  예: "폭죽 소리"
- logits:
  모델이 처음 내놓는 점수. 아직 확률(0~1)이 아니다.
- probabilities:
  logits를 sigmoid로 변환한 0~1 범위의 값. 사람이 보기에는 "확률 비슷한 값"으로 이해하면 된다.
"""

from __future__ import annotations

import argparse
import csv
import json
import math
import os
import sys
from contextlib import nullcontext
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, Optional, Sequence

if os.name == "nt":
    os.environ.setdefault("KMP_DUPLICATE_LIB_OK", "TRUE")


# ---------------------------------------------------------------------------
# 기본 추론 / 후처리 파라미터
# ---------------------------------------------------------------------------
# 아래 상수들은 "모델이 오디오를 어떤 방식으로 읽을지"와
# "읽은 결과를 이벤트로 어떻게 정리할지"를 정하는 기본값이다.
#
# 처음 보는 사람이라면 아래처럼 크게 나눠서 보면 이해하기 쉽다.
# - 샘플레이트 / 청크 길이: 오디오를 어떤 단위로 처리할지
# - threshold / min duration: 어떤 점수를 실제 소리로 인정할지
# - merge gap: 잘게 끊긴 이벤트를 얼마나 이어 붙일지
# - 파일명 관련 상수: 기본으로 사용할 JSON / 체크포인트 경로 이름
DEFAULT_SAMPLE_RATE = 16_000
DEFAULT_CHUNK_SECONDS = 10.0
DEFAULT_CHUNK_HOP_SECONDS = 5.0
DEFAULT_BATCH_SIZE = 0
DEFAULT_CHUNK_AGGREGATION = "center-weighted"
DEFAULT_THRESHOLD = 0.26
DEFAULT_MEDIAN_WINDOW = 7
DEFAULT_MIN_EVENT_DURATION = 0.08
DEFAULT_MIN_EVENT_PEAK = 0.18
DEFAULT_MIN_EVENT_MEAN = 0.04
DEFAULT_MERGE_GAP = 0.08
DEFAULT_RELEASE_THRESHOLD_RATIO = 0.65
DEFAULT_DETECTION_PROFILE = "accessibility"
DEFAULT_ENABLE_TRANSIENT_PASS = True
DEFAULT_TRANSIENT_THRESHOLD = 0.18
DEFAULT_TRANSIENT_MEDIAN_WINDOW = 3
DEFAULT_TRANSIENT_MIN_EVENT_DURATION = 0.04
DEFAULT_TRANSIENT_MIN_EVENT_PEAK = 0.10
DEFAULT_TRANSIENT_MIN_EVENT_MEAN = 0.02
DEFAULT_ENABLE_AMP = True
DEFAULT_CAPTION_SPLIT_MIN_DURATION = 1.50
DEFAULT_CAPTION_SPLIT_MIN_GAP_SECONDS = 0.12
DEFAULT_CAPTION_SPLIT_THRESHOLD_RATIO = 1.15
DEFAULT_CAPTION_SPLIT_RELEASE_RATIO = 0.85
DEFAULT_CAPTION_OVERLAP_RATIO = 0.85
DEFAULT_RESOURCES_DIR = "resources"
DEFAULT_PRETRAINEDSED_ROOT = "PretrainedSED"
DEFAULT_CHECKPOINT_NAME = "ATST-F_strong_1"
DEFAULT_TIMELINE_LANGUAGE = "ko"
DEFAULT_POSTPROCESS_CONFIG_FILENAME = "atstf_environment_postprocess.sample.json"
DEFAULT_LABEL_TRANSLATION_FILENAME = "atst_label_translations.ko.json"
DEFAULT_CAPTION_LABEL_FILENAME = "atst_label_ko.json"
DEFAULT_GROUPED_CAPTION_LABEL_FILENAME = "atst_caption_labels.grouped.ko.json"

# 너무 포괄적이어서 서비스 자막으로는 의미가 약한 raw label 묶음이다.
# 예: "Background noise" 같은 라벨은 실제 사용자에게 도움이 적을 수 있다.
GENERIC_ENVIRONMENT_LABELS = {
    "Background noise",
    "Channel, environment and background",
    "Environmental noise",
    "Mechanisms",
    "Noise",
    "Sound effect",
    "Sound reproduction",
    "Unknown sound",
}

# 사람 목소리 관련 raw label 묶음이다.
# 현재 서비스 흐름에서는 환경음 단계에서 사람 목소리를 별도로 처리할 수 있으므로,
# 필요하면 이 묶음을 한 번에 제외할 수 있게 해 둔 것이다.
HUMAN_VOICE_LABELS = {
    "Babbling",
    "Child speech, kid speaking",
    "Children shouting",
    "Conversation",
    "Female speech, woman speaking",
    "Hubbub, speech noise, speech babble",
    "Human voice",
    "Laughter",
    "Male speech, man speaking",
    "Narration, monologue",
    "Shout",
    "Speech",
}

# 여러 사람 목소리 라벨을 하나로 접을 때 대표로 쓸 이름이다.
COLLAPSED_HUMAN_VOICE_LABEL = "Human voice"


@dataclass
class DetectedEvent:
    """
    기본 후처리까지 끝난 "환경음 이벤트 1개"를 담는 자료구조이다.

    이 구조체는 아직 "최종 자막 문장"이라기보다,
    모델이 찾은 소리 구간을 정리한 중간 결과라고 보면 된다.

    각 필드 의미:
    - event_label:
      모델이 이 이벤트를 무엇이라고 봤는지 나타내는 원본 라벨 이름
    - onset / offset:
      이벤트 시작 / 종료 시각(초)
    - duration:
      이벤트 길이(초)
    - max_confidence:
      이 구간 안에서 가장 높았던 확신도
    - mean_confidence:
      이 구간 전체 평균 확신도
    - caption_label_override:
      내부 raw label 대신, 화면에 보여줄 자막 문구를 따로 지정하고 싶을 때 쓰는 필드
    """

    event_label: str
    onset: float
    offset: float
    duration: float
    max_confidence: float
    mean_confidence: float
    caption_label_override: Optional[str] = None


# ---------------------------------------------------------------------------
# 자막 서비스용 추가 후처리 파라미터
# ---------------------------------------------------------------------------
# 여기 있는 값들은 "모델 이벤트"를 "사람이 읽기 쉬운 자막"으로 바꾸기 위한
# 2차 규칙이다.
#
# 중요:
# - 위의 기본 추론 파라미터는 "모델이 소리를 찾는 기준"에 더 가깝다.
# - 여기의 파라미터는 "찾은 소리를 화면에서 어떻게 보이게 할지"에 더 가깝다.
#
# 즉, 이 구간은 정확도 자체보다 자막 UX에 더 직접적인 영향을 준다.
DEFAULT_SUBTITLE_MERGE_GAP = 0.35
DEFAULT_SUBTITLE_MIN_DURATION = 0.30

# 같은 자막이 짧게 끊겼을 때 어느 정도까지 이어 붙일지 정한다.
# 예:
# - 차량 소리 [0.0~1.0]
# - 차량 소리 [1.5~2.0]
# 중간 공백이 허용 범위 이하면 화면에서는 하나처럼 이어 보이게 만든다.
LABEL_MERGE_GAP_OVERRIDES = {
    "개 소리": 0.80,
    "고양이 소리": 0.80,
    "폭죽 소리": 0.70,
    "발소리": 0.35,
    "사람 목소리": 0.60,
    "웅성거리는 소리": 0.70,
    "비 소리": 0.90,
    "바람 소리": 1.00,
    "차량 소리": 1.00,
    "오토바이 소리": 1.00,
    "경보음": 1.20,
    "불 소리": 1.00,
    "사이렌 소리": 1.20,
    "전화벨/알림음": 1.00,
    "초인종 소리": 1.00,
    "천둥 소리": 1.00,
}

# 자막이 너무 짧으면 읽기 전에 사라질 수 있으므로 라벨별 최소 길이를 정한다.
# 예를 들어 경적은 짧아도 의미가 있지만, 어떤 소리는 너무 짧으면 오히려 산만할 수 있다.
LABEL_MIN_DURATION_OVERRIDES = {
    "경적 소리": 0.15,
    "충격음": 0.15,
    "발소리": 0.18,
    "폭죽 소리": 0.22,
    "경보음": 0.08,
    "불 소리": 0.12,
    "사이렌 소리": 0.12,
    "전화벨/알림음": 0.08,
    "초인종 소리": 0.08,
}

# "멍멍멍", "띠링띠링", "펑펑펑"처럼 반복되는 소리는
# 개별 이벤트를 따로 보여주기보다 하나의 더 큰 자막 구간으로 보이는 편이 자연스럽다.
REPETITIVE_GROUP_GAPS = {
    "개 소리": 1.10,
    "고양이 소리": 1.10,
    "폭죽 소리": 0.95,
    "발소리": 0.45,
    "경보음": 1.40,
    "사이렌 소리": 1.40,
    "전화벨/알림음": 1.10,
    "초인종 소리": 1.10,
}
REPETITIVE_GROUP_MIN_COUNT = 2

# 내부 분류 결과는 유지하되, 최종 화면에 보여 줄 때만 더 단순한 문구로 바꾸고 싶은 경우에 쓴다.
# 예:
# - 내부 분류 라벨: "노래 소리"
# - 화면 표시 라벨: "음악"
DISPLAY_CAPTION_ALIAS_OVERRIDES = {
    "노래 소리": "음악",
}

# display alias를 적용한 뒤 다시 병합할 때 쓰는 추가 gap 규칙이다.
# 음악 계열은 일상 영상에서 길게 이어지는 경우가 많아
# 조금 더 큰 간격도 하나의 구간으로 묶어 화면에 부드럽게 보여준다.
DISPLAY_LABEL_MERGE_GAP_OVERRIDES = {
    "음악": 15.0,
}


@dataclass
class SubtitleEvent:
    """
    자막 서비스용으로 한 번 더 정리한 이벤트 정보이다.

    DetectedEvent와 거의 비슷하지만 차이가 하나 있다.
    - DetectedEvent는 "모델이 찾은 소리" 중심
    - SubtitleEvent는 "화면에 보여줄 자막" 중심

    즉, 이 구조체는 "모델 결과"와 "최종 자막" 사이의 중간 단계라고 보면 된다.
    """

    event_label: str
    caption_label: str
    onset: float
    offset: float
    duration: float
    max_confidence: float
    mean_confidence: float


def build_subtitle_events(
    events: Sequence[DetectedEvent],
    translations: dict[str, str],
    caption_overrides: dict[str, str],
) -> list[SubtitleEvent]:
    """
    기본 이벤트 목록을 자막 서비스용 이벤트 목록으로 변환한다.

    이 단계에서는 원본 이벤트에 caption_label만 추가해 준다.
    아직 병합이나 제거는 하지 않고, "자막 문구가 무엇인지"만 정하는 단계다.
    """

    subtitle_events: list[SubtitleEvent] = []
    for event in events:
        subtitle_events.append(
            SubtitleEvent(
                event_label=event.event_label,
                caption_label=resolve_caption_label(event.event_label, translations, caption_overrides),
                onset=event.onset,
                offset=event.offset,
                duration=event.duration,
                max_confidence=event.max_confidence,
                mean_confidence=event.mean_confidence,
            )
        )
    subtitle_events.sort(key=lambda event: (event.onset, event.offset, event.caption_label, event.event_label))
    return subtitle_events


def merge_subtitle_event_group(events: Sequence[SubtitleEvent]) -> SubtitleEvent:
    """
    같은 자막 라벨로 묶인 여러 이벤트를 하나의 대표 이벤트로 합친다.

    예:
    - [0.0~0.3] 개 소리
    - [0.5~0.8] 개 소리
    - [0.9~1.1] 개 소리

    이런 클러스터를 하나의 더 큰 구간으로 합칠 때 사용한다.
    """

    # 가장 확신도가 높은 raw label을 대표 라벨로 남긴다.
    representative = max(events, key=lambda event: (event.max_confidence, event.mean_confidence))
    merged_onset = min(event.onset for event in events)
    merged_offset = max(event.offset for event in events)

    # 평균 confidence는 단순 산술평균보다, 각 이벤트 길이(duration)를 가중치로 주는 편이
    # 더 자연스럽다. 긴 이벤트가 전체 구간을 더 많이 설명하기 때문이다.
    total_weight = max(sum(max(event.duration, 1e-6) for event in events), 1e-6)
    weighted_mean = sum(event.mean_confidence * max(event.duration, 1e-6) for event in events) / total_weight

    return SubtitleEvent(
        event_label=representative.event_label,
        caption_label=representative.caption_label,
        onset=round(merged_onset, 2),
        offset=round(merged_offset, 2),
        duration=round(max(0.0, merged_offset - merged_onset), 2),
        max_confidence=max(event.max_confidence for event in events),
        mean_confidence=weighted_mean,
    )


def merge_same_subtitle_events(
    events: Sequence[SubtitleEvent],
    default_gap: float,
    label_gap_overrides: dict[str, float],
) -> list[SubtitleEvent]:
    """
    같은 자막 라벨 사이의 짧은 공백을 메워 하나의 자막 구간으로 합친다.

    모델은 프레임 단위로 보면 같은 소리를 여러 조각으로 끊어서 낼 수 있다.
    하지만 자막은 그렇게 잘게 끊기면 읽기 어렵다.
    그래서 "같은 자막이고, 중간 공백이 짧으면" 하나의 자막으로 다시 묶는다.
    """

    if not events:
        return []

    grouped_by_caption: dict[str, list[SubtitleEvent]] = {}
    for event in events:
        grouped_by_caption.setdefault(event.caption_label, []).append(event)

    merged_events: list[SubtitleEvent] = []
    for caption_label, caption_events in grouped_by_caption.items():
        caption_events = sorted(caption_events, key=lambda event: (event.onset, event.offset))
        gap_threshold = label_gap_overrides.get(caption_label, default_gap)

        # cluster는 현재 이어 붙이고 있는 "같은 자막 묶음"이다.
        cluster = [caption_events[0]]
        for event in caption_events[1:]:
            gap = event.onset - cluster[-1].offset
            if gap <= gap_threshold:
                cluster.append(event)
            else:
                merged_events.append(merge_subtitle_event_group(cluster))
                cluster = [event]

        merged_events.append(merge_subtitle_event_group(cluster))

    merged_events.sort(key=lambda event: (event.onset, event.offset, event.caption_label))
    return merged_events


def filter_short_subtitle_events(
    events: Sequence[SubtitleEvent],
    default_min_duration: float,
    label_min_duration_overrides: dict[str, float],
) -> list[SubtitleEvent]:
    """
    너무 짧아서 실제 자막으로 읽기 어려운 구간을 제거한다.

    예를 들어 0.05초짜리 자막은 모델 관점에서는 의미가 있을 수 있어도,
    사람 눈으로는 사실상 읽을 수 없기 때문에 서비스 단계에서는 보통 제거한다.
    """

    filtered: list[SubtitleEvent] = []
    for event in events:
        min_duration = label_min_duration_overrides.get(event.caption_label, default_min_duration)
        if event.duration >= min_duration:
            filtered.append(event)
    return filtered


def group_repetitive_subtitle_events(
    events: Sequence[SubtitleEvent],
    repetitive_gap_overrides: dict[str, float],
    min_count: int,
) -> list[SubtitleEvent]:
    """
    반복형 소리를 하나의 더 큰 자막 구간으로 묶는다.

    예:
    - 개 소리: 멍 / 멍 / 멍
    - 폭죽 소리: 펑 / 펑 / 펑
    - 경보음: 삐 / 삐 / 삐

    이런 소리는 검출 단계에서는 여러 개의 짧은 이벤트로 나와도,
    자막 서비스에서는 "한동안 개가 짖고 있다"처럼 보이는 편이 자연스럽다.
    """

    if not events:
        return []

    grouped_by_caption: dict[str, list[SubtitleEvent]] = {}
    for event in events:
        grouped_by_caption.setdefault(event.caption_label, []).append(event)

    grouped_events: list[SubtitleEvent] = []
    for caption_label, caption_events in grouped_by_caption.items():
        caption_events = sorted(caption_events, key=lambda event: (event.onset, event.offset))
        repetitive_gap = repetitive_gap_overrides.get(caption_label)
        if repetitive_gap is None:
            grouped_events.extend(caption_events)
            continue

        # 반복 소리 후보를 임시로 모으는 묶음.
        cluster = [caption_events[0]]
        for event in caption_events[1:]:
            gap = event.onset - cluster[-1].offset
            if gap <= repetitive_gap:
                cluster.append(event)
            else:
                if len(cluster) >= min_count:
                    grouped_events.append(merge_subtitle_event_group(cluster))
                else:
                    grouped_events.extend(cluster)
                cluster = [event]

        if len(cluster) >= min_count:
            grouped_events.append(merge_subtitle_event_group(cluster))
        else:
            grouped_events.extend(cluster)

    grouped_events.sort(key=lambda event: (event.onset, event.offset, event.caption_label))
    return grouped_events


def subtitle_postprocess(
    events: Sequence[SubtitleEvent],
    default_merge_gap: float,
    default_min_duration: float,
) -> list[SubtitleEvent]:
    """
    서비스 자막 관점에서 이벤트를 한 번 더 정리한다.

    처리 순서:
    1. 같은 자막의 짧은 끊김 병합
    2. 반복형 소리 묶기
    3. 너무 짧은 자막 제거
    4. 마지막으로 한 번 더 같은 자막 병합

    즉, 이 함수는 "모델 결과"를 "사람이 실제로 읽게 될 자막"으로 다듬는 핵심 단계다.
    """

    # 1차 병합: 잘게 끊긴 같은 자막을 먼저 합친다.
    merged_events = merge_same_subtitle_events(
        events,
        default_gap=default_merge_gap,
        label_gap_overrides=LABEL_MERGE_GAP_OVERRIDES,
    )
    # 반복형 소리는 조금 더 큰 묶음으로 다시 정리한다.
    grouped_events = group_repetitive_subtitle_events(
        merged_events,
        repetitive_gap_overrides=REPETITIVE_GROUP_GAPS,
        min_count=REPETITIVE_GROUP_MIN_COUNT,
    )
    # 너무 짧아 읽기 어려운 자막은 제거한다.
    filtered_events = filter_short_subtitle_events(
        grouped_events,
        default_min_duration=default_min_duration,
        label_min_duration_overrides=LABEL_MIN_DURATION_OVERRIDES,
    )
    # 짧은 자막 제거 후 다시 한 번 병합해 결과를 안정화한다.
    final_events = merge_same_subtitle_events(
        filtered_events,
        default_gap=default_merge_gap,
        label_gap_overrides=LABEL_MERGE_GAP_OVERRIDES,
    )
    # 마지막으로 "화면에 보여 줄 자막 정책"을 적용한다.
    # 내부적으로는 `노래 소리`를 유지하더라도, 실제 표시 단계에서는 `음악`으로 통일할 수 있다.
    display_events = apply_display_caption_aliases(final_events, DISPLAY_CAPTION_ALIAS_OVERRIDES)
    if DISPLAY_CAPTION_ALIAS_OVERRIDES:
        merged_display_gap_overrides = dict(LABEL_MERGE_GAP_OVERRIDES)
        merged_display_gap_overrides.update(DISPLAY_LABEL_MERGE_GAP_OVERRIDES)
        display_events = merge_same_subtitle_events(
            display_events,
            default_gap=default_merge_gap,
            label_gap_overrides=merged_display_gap_overrides,
        )

    display_events.sort(key=lambda event: (event.onset, event.offset, event.caption_label))
    return display_events


def apply_display_caption_aliases(
    events: Sequence[SubtitleEvent],
    alias_overrides: dict[str, str],
) -> list[SubtitleEvent]:
    """
    최종 출력 직전에 자막 문구를 다시 단순화한다.

    예:
    - 내부 후처리 결과: `노래 소리`
    - 실제 화면 표시: `음악`

    원본 raw label(event_label)은 유지하고, 화면 표시용 caption_label만 바꾼다.
    """

    if not alias_overrides:
        return list(events)

    aliased_events: list[SubtitleEvent] = []
    for event in events:
        aliased_events.append(
            SubtitleEvent(
                event_label=event.event_label,
                caption_label=alias_overrides.get(event.caption_label, event.caption_label),
                onset=event.onset,
                offset=event.offset,
                duration=event.duration,
                max_confidence=event.max_confidence,
                mean_confidence=event.mean_confidence,
            )
        )

    aliased_events.sort(key=lambda event: (event.onset, event.offset, event.caption_label, event.event_label))
    return aliased_events


def subtitle_events_to_detected_events(events: Sequence[SubtitleEvent]) -> list[DetectedEvent]:
    """
    자막 후처리 결과를 기존 출력 루틴과 호환되는 DetectedEvent로 되돌린다.

    기존 JSON 저장, CSV 저장, 타임라인 출력 함수가 DetectedEvent를 기준으로 짜여 있기 때문에
    자막 후처리를 끝낸 SubtitleEvent를 다시 DetectedEvent 형태로 맞춰 주는 역할이다.
    """

    detected_events: list[DetectedEvent] = []
    for event in events:
        detected_events.append(
            DetectedEvent(
                event_label=event.event_label,
                onset=event.onset,
                offset=event.offset,
                duration=event.duration,
                max_confidence=event.max_confidence,
                mean_confidence=event.mean_confidence,
                caption_label_override=event.caption_label,
            )
        )
    return detected_events


def parse_label_value_overrides(
    raw_items: Sequence[str],
    option_name: str,
    min_value: Optional[float] = None,
    max_value: Optional[float] = None,
) -> dict[str, float]:
    """CLI에서 받은 `Label=값` 형식 옵션을 `{라벨: 값}` 딕셔너리로 변환한다."""

    overrides: dict[str, float] = {}
    for item in raw_items:
        if "=" not in item:
            raise ValueError(
                f"{option_name} 형식이 올바르지 않습니다: {item}\n"
                "예) --label-threshold \"Fireworks=0.24\""
            )

        label, raw_value = item.split("=", 1)
        label = label.strip()
        raw_value = raw_value.strip()

        if not label:
            raise ValueError(f"{option_name}에서 라벨 이름이 비어 있습니다: {item}")

        try:
            value = float(raw_value)
        except ValueError as exc:
            raise ValueError(f"{option_name} 값은 숫자여야 합니다: {item}") from exc

        if min_value is not None and value < min_value:
            raise ValueError(f"{option_name} 값은 {min_value} 이상이어야 합니다: {item}")
        if max_value is not None and value > max_value:
            raise ValueError(f"{option_name} 값은 {max_value} 이하여야 합니다: {item}")

        overrides[label] = value

    return overrides


def validate_label_value_map(
    raw_map: object,
    option_name: str,
    min_value: Optional[float] = None,
    max_value: Optional[float] = None,
) -> dict[str, float]:
    """JSON에서 읽은 라벨별 수치 설정을 검증하고 float 딕셔너리로 정리한다."""

    if raw_map is None:
        return {}
    if not isinstance(raw_map, dict):
        raise ValueError(f"{option_name}은 딕셔너리(dict) 형태여야 합니다.")

    validated: dict[str, float] = {}
    for raw_label, raw_value in raw_map.items():
        if not isinstance(raw_label, str) or not raw_label.strip():
            raise ValueError(f"{option_name}의 키는 비어 있지 않은 문자열이어야 합니다.")

        try:
            value = float(raw_value)
        except (TypeError, ValueError) as exc:
            raise ValueError(f"{option_name}[{raw_label}] 값은 숫자여야 합니다.") from exc

        if min_value is not None and value < min_value:
            raise ValueError(f"{option_name}[{raw_label}] 값은 {min_value} 이상이어야 합니다.")
        if max_value is not None and value > max_value:
            raise ValueError(f"{option_name}[{raw_label}] 값은 {max_value} 이하여야 합니다.")

        validated[raw_label.strip()] = value

    return validated


def load_postprocess_config(config_path: Optional[Path]) -> dict[str, object]:
    """후처리 JSON 설정 파일을 읽어 제외 라벨과 라벨별 보정값을 반환한다."""

    empty_config = {
        "exclude_labels": [],
        "label_thresholds": {},
        "label_min_peak": {},
        "label_min_mean": {},
        "label_min_duration": {},
    }

    if config_path is None:
        return empty_config

    config_path = Path(config_path).expanduser().resolve()
    if not config_path.exists():
        raise FileNotFoundError(f"후처리 설정 파일을 찾을 수 없습니다: {config_path}")

    with config_path.open("r", encoding="utf-8") as file:
        payload = json.load(file)

    if not isinstance(payload, dict):
        raise ValueError("후처리 설정 파일의 최상위 구조는 JSON 객체여야 합니다.")

    exclude_labels = payload.get("exclude_labels", [])
    if not isinstance(exclude_labels, list) or any(not isinstance(item, str) for item in exclude_labels):
        raise ValueError("exclude_labels는 문자열 리스트여야 합니다.")

    return {
        "exclude_labels": [label.strip() for label in exclude_labels if label.strip()],
        "label_thresholds": validate_label_value_map(
            payload.get("label_thresholds"),
            "label_thresholds",
            min_value=0.0,
            max_value=1.0,
        ),
        "label_min_peak": validate_label_value_map(
            payload.get("label_min_peak"),
            "label_min_peak",
            min_value=0.0,
            max_value=1.0,
        ),
        "label_min_mean": validate_label_value_map(
            payload.get("label_min_mean"),
            "label_min_mean",
            min_value=0.0,
            max_value=1.0,
        ),
        "label_min_duration": validate_label_value_map(
            payload.get("label_min_duration"),
            "label_min_duration",
            min_value=0.0,
        ),
    }


def merge_override_maps(config_map: dict[str, float], cli_map: dict[str, float]) -> dict[str, float]:
    """설정 파일 값과 CLI override를 병합한다. 같은 키가 있으면 CLI 값을 우선한다."""

    merged = dict(config_map)
    merged.update(cli_map)
    return merged


def load_label_translation_map(config_path: Optional[Path]) -> dict[str, str]:
    """라벨 번역 또는 자막 매핑 JSON 파일을 읽어 `{영문: 한글}` 딕셔너리로 반환한다."""

    if config_path is None:
        return {}

    resolved = Path(config_path).expanduser().resolve()
    if not resolved.exists():
        raise FileNotFoundError(f"라벨 번역 설정 파일을 찾을 수 없습니다: {resolved}")

    with resolved.open("r", encoding="utf-8") as file:
        payload = json.load(file)

    if not isinstance(payload, dict):
        raise ValueError("라벨 번역 설정 파일은 {영문: 한글} 형태의 JSON 객체여야 합니다.")

    translations: dict[str, str] = {}
    for raw_label, raw_translated in payload.items():
        if not isinstance(raw_label, str) or not raw_label.strip():
            raise ValueError("라벨 번역 설정 파일의 key는 비어 있지 않은 문자열이어야 합니다.")
        if not isinstance(raw_translated, str) or not raw_translated.strip():
            raise ValueError(
                f"라벨 번역 설정 파일의 value는 비어 있지 않은 문자열이어야 합니다: {raw_label}"
            )
        translations[raw_label.strip()] = raw_translated.strip()

    return translations


def resolve_default_label_translation_path() -> Optional[Path]:
    """스크립트와 같은 폴더에서 기본 라벨 번역 파일 경로를 찾는다."""

    candidate = Path(__file__).resolve().parent / DEFAULT_LABEL_TRANSLATION_FILENAME
    if candidate.exists():
        return candidate
    return None


def resolve_default_postprocess_config_path() -> Optional[Path]:
    """스크립트와 같은 폴더에서 기본 후처리 설정 파일 경로를 찾는다."""

    candidate = Path(__file__).resolve().parent / DEFAULT_POSTPROCESS_CONFIG_FILENAME
    if candidate.exists():
        return candidate
    return None


def resolve_default_caption_label_path() -> Optional[Path]:
    """스크립트와 같은 폴더에서 기본 자막 문구 매핑 파일 경로를 찾는다."""

    candidate = Path(__file__).resolve().parent / DEFAULT_CAPTION_LABEL_FILENAME
    if candidate.exists():
        return candidate
    return None


def resolve_default_grouped_caption_label_path() -> Optional[Path]:
    """하위 호환을 위해 예전 grouped caption 파일 경로를 찾는다."""

    candidate = Path(__file__).resolve().parent / DEFAULT_GROUPED_CAPTION_LABEL_FILENAME
    if candidate.exists():
        return candidate
    return None


def resolve_label_translation(label: str, translations: dict[str, str]) -> Optional[str]:
    """번역 딕셔너리에서 직접 키 또는 부분 라벨 기준으로 번역 값을 찾는다."""

    translated = translations.get(label)
    if translated is not None:
        return translated

    if "," in label:
        for part in [item.strip() for item in label.split(",")]:
            translated = translations.get(part)
            if translated is not None:
                return translated

    return None


def resolve_caption_label(
    label: str,
    translations: dict[str, str],
    caption_overrides: dict[str, str],
) -> str:
    """자막 문구를 결정한다. caption override -> 일반 번역 -> 원본 라벨 순으로 fallback한다."""

    caption_label = resolve_label_translation(label, caption_overrides)
    if caption_label is not None:
        return caption_label

    translated_label = resolve_label_translation(label, translations)
    if translated_label is not None:
        return translated_label

    return label


def format_event_label_for_display(
    event: DetectedEvent,
    translations: dict[str, str],
    caption_overrides: dict[str, str],
    language: str,
) -> str:
    """타임라인 출력에 사용할 라벨 문자열을 언어 설정에 맞게 만든다."""

    label_en = event.event_label
    label_ko = resolve_label_translation(label_en, translations)
    caption_label = event.caption_label_override or resolve_caption_label(label_en, translations, caption_overrides)

    if language == "ko":
        return caption_label
    if language == "both":
        if caption_label != label_en or label_ko is not None:
            return f"{caption_label} ({label_en})"
        return label_en
    return label_en


def serialize_event(
    event: DetectedEvent,
    translations: dict[str, str],
    caption_overrides: dict[str, str],
) -> dict[str, object]:
    """DetectedEvent를 JSON/CSV 저장용 딕셔너리로 변환한다."""

    label_en = event.event_label
    label_ko = resolve_label_translation(label_en, translations)
    caption_label = event.caption_label_override or resolve_caption_label(label_en, translations, caption_overrides)
    if label_ko is None and caption_label != label_en:
        label_ko = caption_label

    return {
        "event_label": label_en,
        "label_en": label_en,
        "label_ko": label_ko,
        "caption_label": caption_label,
        "onset": event.onset,
        "offset": event.offset,
        "duration": event.duration,
        "max_confidence": event.max_confidence,
        "mean_confidence": event.mean_confidence,
    }


def _rank_top_labels(probabilities, labels: Sequence[str], top_k: int) -> list[tuple[str, float, float]]:
    """확률 행렬에서 상위 raw/caption 라벨을 정렬해 돌려준다."""

    if top_k <= 0 or probabilities.size == 0 or not labels:
        return []

    np = get_numpy()
    max_scores = probabilities.max(axis=0)
    mean_scores = probabilities.mean(axis=0)
    sorted_indices = np.argsort(max_scores)[::-1][:top_k]
    return [
        (labels[index], float(max_scores[index]), float(mean_scores[index]))
        for index in sorted_indices.tolist()
    ]


def print_probability_debug(
    probabilities,
    labels: Sequence[str],
    events: Sequence[DetectedEvent],
    translations: dict[str, str],
    caption_overrides: dict[str, str],
    frame_resolution: float,
    top_k: int,
    excluded_labels: Optional[set[str]] = None,
) -> None:
    """모델이 어떤 후보 라벨을 강하게 보고 있는지 디버그 출력한다."""

    if top_k <= 0:
        return

    print("-" * 80)
    print(f"[DEBUG] 전체 raw label 상위 {top_k}개")
    for rank, (label, max_score, mean_score) in enumerate(_rank_top_labels(probabilities, labels, top_k), 1):
        caption_label = resolve_caption_label(label, translations, caption_overrides)
        print(f"{rank:02d}. {label} -> {caption_label} (max={max_score:.3f}, mean={mean_score:.3f})")

    caption_probabilities, caption_labels, _caption_to_raw = build_caption_probability_view(
        probabilities=probabilities,
        labels=labels,
        translations=translations,
        caption_overrides=caption_overrides,
        excluded_labels=excluded_labels,
    )
    print(f"\n[DEBUG] 전체 caption label 상위 {top_k}개")
    for rank, (label, max_score, mean_score) in enumerate(
        _rank_top_labels(caption_probabilities, caption_labels, top_k),
        1,
    ):
        print(f"{rank:02d}. {label} (max={max_score:.3f}, mean={mean_score:.3f})")

    for event in events:
        start_frame = max(0, int(math.floor(event.onset / frame_resolution)))
        end_frame = min(probabilities.shape[0], int(math.ceil(event.offset / frame_resolution)))
        if end_frame <= start_frame:
            continue

        print(
            f"\n[DEBUG] 이벤트 구간 후보: {event.onset:.2f}s ~ {event.offset:.2f}s "
            f"/ {resolve_caption_label(event.event_label, translations, caption_overrides)}"
        )
        window_probabilities = probabilities[start_frame:end_frame]
        for rank, (label, max_score, mean_score) in enumerate(
            _rank_top_labels(window_probabilities, labels, top_k),
            1,
        ):
            caption_label = resolve_caption_label(label, translations, caption_overrides)
            print(f"{rank:02d}. {label} -> {caption_label} (max={max_score:.3f}, mean={mean_score:.3f})")


def parse_args() -> argparse.Namespace:
    """
    명령줄 옵션을 정의하고 기본값을 정리한다.

    이 함수는 "사용자가 어떤 값을 바꿔서 실행할 수 있는지"를 한곳에 모아 둔 부분이다.
    처음 읽는다면 아래 네 묶음으로 나눠서 보면 이해가 쉽다.

    1. 입력/모델 경로
       - 어떤 wav를 읽을지
       - 어떤 체크포인트를 쓸지

    2. 기본 이벤트 검출 규칙
       - threshold
       - 최소 길이
       - smoothing

    3. 자막용 추가 후처리 규칙
       - 같은 자막 병합
       - 너무 짧은 자막 제거

    4. 성능/디버그 옵션
       - GPU/CPU
       - batch size
       - debug 출력
    """

    parser = argparse.ArgumentParser(
        description="ATST-F 모델로 .wav 파일 안의 다중 환경음을 프레임 단위로 분석합니다."
    )
    # ------------------------------------------------------------------
    # 1) 입력 파일과 모델 경로
    # ------------------------------------------------------------------
    # 실제 서비스에서는 보통 Demucs가 분리한 "환경음 wav" 경로가 들어온다고 보면 된다.
    parser.add_argument("--audio-file", type=Path, required=True, help="분석할 입력 .wav 파일 경로")
    parser.add_argument(
        "--pretrainedsed-root",
        type=Path,
        default=Path(DEFAULT_PRETRAINEDSED_ROOT),
        help="PretrainedSED 저장소 루트 경로 (기본값: ./PretrainedSED)",
    )
    parser.add_argument(
        "--checkpoint-name",
        type=str,
        default=DEFAULT_CHECKPOINT_NAME,
        help="공식 체크포인트 이름. --checkpoint-path를 주지 않으면 이름으로 자동 다운로드를 시도합니다.",
    )
    parser.add_argument(
        "--checkpoint-path",
        type=Path,
        default=None,
        help="직접 사용할 .pt 체크포인트 경로. 가능하면 --checkpoint-name보다 이 옵션 사용을 권장합니다.",
    )
    parser.add_argument(
        "--resources-dir",
        type=Path,
        default=Path(DEFAULT_RESOURCES_DIR),
        help="체크포인트 파일을 찾거나 다운로드할 리소스 폴더",
    )
    parser.add_argument(
        "--postprocess-config",
        type=Path,
        default=None,
        help="라벨 calibration / 제외 라벨 규칙이 들어 있는 후처리 JSON 설정 파일 경로",
    )
    parser.add_argument(
        "--label-translation-config",
        type=Path,
        default=None,
        help="영문 라벨을 한국어로 바꿀 번역 JSON 파일 경로",
    )
    parser.add_argument(
        "--caption-label-config",
        type=Path,
        default=None,
        help="서비스용 자막 문구 override JSON 파일 경로",
    )
    # ------------------------------------------------------------------
    # 2) 기본 이벤트 검출 기준
    # ------------------------------------------------------------------
    # 여기 있는 값들은 "모델 점수를 실제 소리 이벤트로 인정할지"를 결정한다.
    parser.add_argument(
        "--threshold",
        type=float,
        default=DEFAULT_THRESHOLD,
        help=f"프레임을 활성 상태로 판정할 확률 기준값 (기본값: {DEFAULT_THRESHOLD})",
    )
    parser.add_argument(
        "--median-window",
        type=int,
        default=DEFAULT_MEDIAN_WINDOW,
        help=f"Median filter 크기 (프레임 기준, 기본값: {DEFAULT_MEDIAN_WINDOW})",
    )
    parser.add_argument(
        "--min-event-duration",
        type=float,
        default=DEFAULT_MIN_EVENT_DURATION,
        help=f"너무 짧은 이벤트를 제거할 최소 길이 (초 단위, 기본값: {DEFAULT_MIN_EVENT_DURATION})",
    )
    parser.add_argument(
        "--min-event-peak",
        type=float,
        default=DEFAULT_MIN_EVENT_PEAK,
        help=f"이벤트 구간 안의 최대 확률이 넘어야 할 최소값 (기본값: {DEFAULT_MIN_EVENT_PEAK})",
    )
    parser.add_argument(
        "--min-event-mean",
        type=float,
        default=DEFAULT_MIN_EVENT_MEAN,
        help=f"이벤트 구간 안의 평균 확률이 넘어야 할 최소값 (기본값: {DEFAULT_MIN_EVENT_MEAN})",
    )
    parser.add_argument(
        "--merge-gap",
        type=float,
        default=DEFAULT_MERGE_GAP,
        help=f"같은 라벨 이벤트 사이 간격이 이 값 이하이면 병합합니다 (초 단위, 기본값: {DEFAULT_MERGE_GAP})",
    )
    parser.add_argument(
        "--chunk-seconds",
        type=float,
        default=DEFAULT_CHUNK_SECONDS,
        help=(
            "한 번에 추론할 청크 길이(초). "
            "ATST-F strong 체크포인트는 10초 기준이므로 10.0 사용을 권장합니다."
        ),
    )
    parser.add_argument(
        "--chunk-hop-seconds",
        type=float,
        default=DEFAULT_CHUNK_HOP_SECONDS,
        help=(
            "다음 청크 시작 간격(초). chunk-seconds보다 작게 주면 겹치는 추론이 수행되어 "
            "경계 구간 안정성이 좋아집니다 (기본값: 5.0)"
        ),
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=DEFAULT_BATCH_SIZE,
        help="청크를 몇 개씩 묶어 추론할지 지정합니다. 0이면 장치에 맞춰 자동 결정합니다.",
    )
    parser.add_argument(
        "--chunk-aggregation",
        choices=("mean", "center-weighted"),
        default=DEFAULT_CHUNK_AGGREGATION,
        help="겹치는 청크를 결합할 때 중앙 프레임에 더 큰 가중치를 줄지 선택합니다.",
    )
    parser.add_argument(
        "--detection-profile",
        choices=("balanced", "accessibility"),
        default=DEFAULT_DETECTION_PROFILE,
        help="후처리 프로필 이름. accessibility는 짧고 겹치는 환경음을 더 적극적으로 살립니다.",
    )
    # 짧고 순간적인 소리를 더 잘 잡기 위한 보조 transient pass 설정
    parser.add_argument(
        "--disable-transient-pass",
        action="store_true",
        help="짧고 순간적인 소리를 더 잘 잡기 위한 transient pass를 끕니다.",
    )
    parser.add_argument(
        "--transient-threshold",
        type=float,
        default=DEFAULT_TRANSIENT_THRESHOLD,
        help=f"보조 transient pass threshold (기본값: {DEFAULT_TRANSIENT_THRESHOLD})",
    )
    parser.add_argument(
        "--transient-median-window",
        type=int,
        default=DEFAULT_TRANSIENT_MEDIAN_WINDOW,
        help=f"보조 transient pass median window (기본값: {DEFAULT_TRANSIENT_MEDIAN_WINDOW})",
    )
    parser.add_argument(
        "--transient-min-event-duration",
        type=float,
        default=DEFAULT_TRANSIENT_MIN_EVENT_DURATION,
        help=f"보조 transient pass 최소 이벤트 길이 (기본값: {DEFAULT_TRANSIENT_MIN_EVENT_DURATION})",
    )
    parser.add_argument(
        "--transient-min-event-peak",
        type=float,
        default=DEFAULT_TRANSIENT_MIN_EVENT_PEAK,
        help=f"보조 transient pass 최소 peak 값 (기본값: {DEFAULT_TRANSIENT_MIN_EVENT_PEAK})",
    )
    parser.add_argument(
        "--transient-min-event-mean",
        type=float,
        default=DEFAULT_TRANSIENT_MIN_EVENT_MEAN,
        help=f"보조 transient pass 최소 mean 값 (기본값: {DEFAULT_TRANSIENT_MIN_EVENT_MEAN})",
    )
    parser.add_argument(
        "--release-threshold-ratio",
        type=float,
        default=DEFAULT_RELEASE_THRESHOLD_RATIO,
        help="이벤트가 켜진 뒤 꺼질 때 적용할 완화 threshold 비율",
    )
    parser.add_argument(
        "--suppress-generic-labels",
        action="store_true",
        help="Background noise 같은 범용/저설명 라벨을 결과에서 제외합니다.",
    )
    parser.add_argument(
        "--suppress-human-voice",
        action="store_true",
        help="환경음만 보고 싶다면 사람 목소리 계열 라벨을 결과에서 제외합니다.",
    )
    parser.add_argument(
        "--timeline-language",
        choices=("original", "ko", "both"),
        default=DEFAULT_TIMELINE_LANGUAGE,
        help="타임라인 출력에 사용할 라벨 언어",
    )
    parser.add_argument(
        "--collapse-human-voice",
        action="store_true",
        help="Male/Female speech 등 사람 목소리 계열 라벨을 모두 'Human voice'로 통합합니다.",
    )
    # 라벨별로 기준값을 따로 조정하고 싶을 때 쓰는 세부 override 옵션
    parser.add_argument(
        "--exclude-label",
        action="append",
        default=[],
        help="결과에서 제외할 raw label을 추가합니다. 여러 번 지정할 수 있습니다.",
    )
    parser.add_argument(
        "--label-threshold",
        action="append",
        default=[],
        help='특정 라벨의 threshold를 덮어씁니다. 예: "Fireworks=0.24"',
    )
    parser.add_argument(
        "--label-min-peak",
        action="append",
        default=[],
        help='특정 라벨의 최소 peak 값을 덮어씁니다. 예: "Alarm=0.15"',
    )
    parser.add_argument(
        "--label-min-mean",
        action="append",
        default=[],
        help='특정 라벨의 최소 mean 값을 덮어씁니다. 예: "Alarm=0.05"',
    )
    parser.add_argument(
        "--label-min-duration",
        action="append",
        default=[],
        help='특정 라벨의 최소 이벤트 길이를 덮어씁니다. 예: "Fire=0.10"',
    )
    parser.add_argument(
        "--device",
        choices=("auto", "cpu", "cuda"),
        default="auto",
        help="추론 장치를 선택합니다 (기본값: auto)",
    )
    # 성능, 출력, 자막용 추가 후처리 옵션
    parser.add_argument(
        "--disable-amp",
        action="store_true",
        help="CUDA mixed precision(AMP) 사용을 끕니다.",
    )
    parser.add_argument(
        "--quiet",
        action="store_true",
        help="불필요한 로그를 줄이고 핵심 결과만 출력합니다.",
    )
    parser.add_argument(
        "--disable-subtitle-postprocess",
        action="store_true",
        help="자막 서비스용 추가 후처리(같은 자막 병합, 짧은 자막 제거, 반복형 소리 묶기)를 끕니다.",
    )
    parser.add_argument(
        "--subtitle-merge-gap",
        type=float,
        default=DEFAULT_SUBTITLE_MERGE_GAP,
        help=f"자막용 추가 병합 단계에서 같은 자막 사이를 병합할 기본 gap 값 (초 단위, 기본값: {DEFAULT_SUBTITLE_MERGE_GAP})",
    )
    parser.add_argument(
        "--subtitle-min-duration",
        type=float,
        default=DEFAULT_SUBTITLE_MIN_DURATION,
        help=f"자막용 추가 후처리에서 유지할 최소 자막 길이 (초 단위, 기본값: {DEFAULT_SUBTITLE_MIN_DURATION})",
    )
    parser.add_argument(
        "--debug-top-k",
        type=int,
        default=0,
        help="상위 raw/caption 후보 라벨을 디버그 출력할 개수. 0이면 출력하지 않습니다.",
    )
    parser.add_argument("--json-out", type=Path, default=None, help="최종 이벤트를 JSON으로 저장할 경로")
    parser.add_argument("--csv-out", type=Path, default=None, help="최종 이벤트를 CSV로 저장할 경로")

    args = parser.parse_args()

    if args.postprocess_config is None:
        args.postprocess_config = resolve_default_postprocess_config_path()

    if args.threshold < 0.0 or args.threshold > 1.0:
        raise ValueError("--threshold는 0.0 이상 1.0 이하여야 합니다.")
    if args.median_window < 1:
        raise ValueError("--median-window는 1 이상의 정수여야 합니다.")
    if args.transient_median_window < 1:
        raise ValueError("--transient-median-window는 1 이상의 정수여야 합니다.")
    if args.min_event_duration < 0.0:
        raise ValueError("--min-event-duration은 0 이상이어야 합니다.")
    if args.transient_min_event_duration < 0.0:
        raise ValueError("--transient-min-event-duration은 0 이상이어야 합니다.")
    if args.min_event_peak < 0.0 or args.min_event_peak > 1.0:
        raise ValueError("--min-event-peak는 0.0 이상 1.0 이하여야 합니다.")
    if args.transient_threshold < 0.0 or args.transient_threshold > 1.0:
        raise ValueError("--transient-threshold는 0.0 이상 1.0 이하여야 합니다.")
    if args.transient_min_event_peak < 0.0 or args.transient_min_event_peak > 1.0:
        raise ValueError("--transient-min-event-peak는 0.0 이상 1.0 이하여야 합니다.")
    if args.min_event_mean < 0.0 or args.min_event_mean > 1.0:
        raise ValueError("--min-event-mean는 0.0 이상 1.0 이하여야 합니다.")
    if args.transient_min_event_mean < 0.0 or args.transient_min_event_mean > 1.0:
        raise ValueError("--transient-min-event-mean는 0.0 이상 1.0 이하여야 합니다.")
    if args.chunk_seconds <= 0.0:
        raise ValueError("--chunk-seconds는 0보다 커야 합니다.")
    if args.chunk_hop_seconds <= 0.0:
        raise ValueError("--chunk-hop-seconds는 0보다 커야 합니다.")
    if args.batch_size < 0:
        raise ValueError("--batch-size는 0 이상이어야 합니다.")
    if args.chunk_hop_seconds > args.chunk_seconds:
        raise ValueError("--chunk-hop-seconds는 --chunk-seconds보다 작아야 합니다.")
    if args.merge_gap < 0.0:
        raise ValueError("--merge-gap은 0 이상이어야 합니다.")
    if args.release_threshold_ratio < 0.0 or args.release_threshold_ratio > 1.0:
        raise ValueError("--release-threshold-ratio는 0.0 이상 1.0 이하여야 합니다.")
    if args.debug_top_k < 0:
        raise ValueError("--debug-top-k는 0 이상이어야 합니다.")

    args.label_threshold_map = parse_label_value_overrides(
        args.label_threshold,
        "--label-threshold",
        min_value=0.0,
        max_value=1.0,
    )
    args.label_min_peak_map = parse_label_value_overrides(
        args.label_min_peak,
        "--label-min-peak",
        min_value=0.0,
        max_value=1.0,
    )
    args.label_min_mean_map = parse_label_value_overrides(
        args.label_min_mean,
        "--label-min-mean",
        min_value=0.0,
        max_value=1.0,
    )
    args.label_min_duration_map = parse_label_value_overrides(
        args.label_min_duration,
        "--label-min-duration",
        min_value=0.0,
    )

    return args


def get_torch():
    """필요할 때만 torch를 import한다."""

    try:
        import torch
    except OSError as exc:
        raise RuntimeError(
            "PyTorch DLL 로딩에 실패했습니다. "
            "Windows라면 Visual C++ 재배포 패키지와 torch 설치 상태를 확인해 주세요."
        ) from exc
    return torch


def get_numpy():
    """필요할 때만 numpy를 import한다."""

    import numpy as np

    return np


def get_librosa():
    """필요할 때만 librosa를 import한다."""

    import librosa

    return librosa


def get_soundfile():
    """필요할 때만 soundfile을 import한다."""

    import soundfile as sf

    return sf


def get_median_filter():
    """필요할 때만 scipy의 median filter를 import한다."""

    from scipy.ndimage import median_filter

    return median_filter


def prepare_pretrainedsed_import(pretrainedsed_root: Path) -> None:
    """
    PretrainedSED 폴더를 import할 수 있도록 Python 경로(sys.path)를 준비한다.

    이 프로젝트는 `pip install pretrainedsed`처럼 설치하는 구조가 아니라,
    `PretrainedSED`라는 폴더 안의 코드를 직접 import해서 사용한다.
    그래서 이 함수가 먼저 해당 폴더를 Python이 찾을 수 있게 만들어 준다.
    """

    root = pretrainedsed_root.expanduser().resolve()
    if not root.exists():
        raise FileNotFoundError(
            f"PretrainedSED 경로를 찾을 수 없습니다: {root}\n"
            "예) git clone https://github.com/fschmid56/PretrainedSED.git"
        )

    root_str = str(root)
    if root_str not in sys.path:
        sys.path.insert(0, root_str)


def _load_pretrainedsed_modules():
    """설치된 패키지 또는 로컬 경로에서 PretrainedSED 모듈을 불러온다."""

    from pretrainedsed.config import CHECKPOINT_URLS
    from pretrainedsed.data_util import audioset_classes
    from pretrainedsed.models.atstframe.ATSTF_wrapper import ATSTWrapper
    from pretrainedsed.models.prediction_wrapper import PredictionsWrapper

    return ATSTWrapper, PredictionsWrapper, audioset_classes.as_strong_train_classes, CHECKPOINT_URLS


def import_pretrainedsed_modules(pretrainedsed_root: Path):
    """
    ATST-F 모델 생성에 필요한 PretrainedSED 모듈을 실제로 import한다.

    여기서 불러오는 대표 요소:
    - ATST backbone wrapper
    - prediction wrapper
    - AudioSet 클래스 목록
    - 체크포인트 다운로드 URL
    """

    try:
        return _load_pretrainedsed_modules()
    except ModuleNotFoundError:
        prepare_pretrainedsed_import(pretrainedsed_root)

    try:
        return _load_pretrainedsed_modules()
    except ModuleNotFoundError as exc:
        raise ModuleNotFoundError(
            "ATST-F 로딩에 필요한 의존성이 부족합니다. "
            "PretrainedSED를 `pip install -e ./PretrainedSED`로 설치하거나 "
            "`--pretrainedsed-root`로 로컬 폴더 경로를 지정해야 합니다. "
            "또한 torch, torchaudio, librosa, scipy, numpy가 필요합니다."
        ) from exc


def resolve_device(device_name: str):
    """
    추론에 사용할 장치를 결정한다.

    - `cpu`: CPU 강제 사용
    - `cuda`: GPU 강제 사용
    - `auto` 성격의 값: 가능하면 GPU, 아니면 CPU
    """

    torch = get_torch()

    if device_name == "cpu":
        return torch.device("cpu")
    if device_name == "cuda":
        if not torch.cuda.is_available():
            raise RuntimeError("CUDA를 요청했지만 현재 환경에서 GPU를 사용할 수 없습니다.")
        return torch.device("cuda")
    return torch.device("cuda" if torch.cuda.is_available() else "cpu")


def resolve_checkpoint_path(
    checkpoint_name: str,
    checkpoint_path: Optional[Path],
    resources_dir: Path,
    checkpoint_urls: dict,
) -> Path:
    """
    체크포인트 이름 또는 경로를 실제 `.pt` 파일 경로로 바꾼다.

    경우는 두 가지다.
    1. 사용자가 `--checkpoint-path`로 직접 파일 경로를 준 경우
    2. 체크포인트 이름만 주고, resources 폴더에서 찾거나 다운로드하는 경우
    """

    if checkpoint_path is not None:
        resolved = checkpoint_path.expanduser().resolve()
        if not resolved.exists():
            raise FileNotFoundError(f"지정한 체크포인트 파일을 찾을 수 없습니다: {resolved}")
        return resolved

    if checkpoint_name not in checkpoint_urls:
        valid_names = ", ".join(sorted(checkpoint_urls.keys()))
        raise ValueError(
            f"지원하지 않는 checkpoint 이름입니다: {checkpoint_name}\n"
            f"사용 가능한 이름: {valid_names}"
        )

    resources_dir = resources_dir.expanduser().resolve()
    resources_dir.mkdir(parents=True, exist_ok=True)
    resolved = resources_dir / f"{checkpoint_name}.pt"

    if resolved.exists():
        return resolved

    torch = get_torch()
    try:
        torch.hub.download_url_to_file(checkpoint_urls[checkpoint_name], str(resolved))
    except Exception as exc:
        raise RuntimeError(
            "체크포인트 자동 다운로드에 실패했습니다. "
            "--checkpoint-path로 로컬 .pt 파일을 직접 지정해 주세요."
        ) from exc

    return resolved


def load_prediction_wrapper_state_dict(model, checkpoint_path: Path) -> None:
    """
    체크포인트 파일에서 모델 가중치(state dict)를 읽어 현재 모델에 넣는다.

    초심자 관점에서 state dict는
    "학습이 끝난 모델이 기억하고 있는 숫자 파라미터 묶음" 정도로 이해하면 충분하다.
    """

    torch = get_torch()
    state = torch.load(str(checkpoint_path), map_location="cpu")

    if isinstance(state, dict) and "state_dict" in state:
        state = state["state_dict"]
    if not isinstance(state, dict):
        raise RuntimeError(f"체크포인트 형식을 해석할 수 없습니다: {checkpoint_path}")

    if state and all(isinstance(key, str) and key.startswith("module.") for key in state.keys()):
        state = {key[len("module."):]: value for key, value in state.items()}

    missing_keys, unexpected_keys = model.load_state_dict(state, strict=False)
    allowed_missing = [key for key in missing_keys if "mel_transform" in key]
    disallowed_missing = [key for key in missing_keys if key not in allowed_missing]

    if disallowed_missing or unexpected_keys:
        raise RuntimeError(
            "체크포인트 로딩 중 불일치가 발생했습니다.\n"
            f"허용되지 않은 missing keys: {disallowed_missing}\n"
            f"unexpected keys: {unexpected_keys}\n"
            "ATST-F strong용 PretrainedSED 체크포인트인지 확인해 주세요."
        )


def build_model(
    pretrainedsed_root: Path,
    checkpoint_name: str,
    checkpoint_path: Optional[Path],
    resources_dir: Path,
    device,
):
    """
    ATST-F 모델과 클래스 라벨 목록을 준비한다.

    여기서 하는 일은 크게 3가지다.
    1. PretrainedSED 안의 모델 코드를 import한다.
    2. 체크포인트(.pt) 파일을 찾는다.
    3. 학습된 가중치를 모델에 로드하고, 추론 전용 상태(eval mode)로 바꾼다.

    즉, "실제로 예측 가능한 상태의 모델"을 만드는 단계다.
    """

    ATSTWrapper, PredictionsWrapper, class_labels, checkpoint_urls = import_pretrainedsed_modules(
        pretrainedsed_root
    )

    # PredictionsWrapper는 ATST backbone 위에
    # "실제로 AudioSet 클래스를 예측하는 부분"까지 붙여 놓은 객체라고 이해하면 된다.
    model = PredictionsWrapper(ATSTWrapper(), checkpoint=None)
    resolved_checkpoint = resolve_checkpoint_path(
        checkpoint_name=checkpoint_name,
        checkpoint_path=checkpoint_path,
        resources_dir=resources_dir,
        checkpoint_urls=checkpoint_urls,
    )
    load_prediction_wrapper_state_dict(model, resolved_checkpoint)

    # eval 모드는 학습이 아니라 추론만 할 때 쓰는 설정이다.
    # dropout 같은 학습용 동작을 끄고, 결과를 더 안정적으로 만든다.
    model.eval()
    model.to(device)
    return model, class_labels, resolved_checkpoint


def load_audio(audio_path: Path):
    """
    오디오 파일을 mono 16kHz 파형으로 로드한다.

    모델은 결국 "숫자 배열 형태의 파형(waveform)"을 입력으로 받는다.
    그래서 파일 포맷이 wav/mp3인지보다, 최종적으로 16kHz mono 파형으로
    바꿔 주는 과정이 더 중요하다.
    """

    audio_path = Path(audio_path).expanduser().resolve()
    if not audio_path.exists():
        raise FileNotFoundError(f"입력 오디오 파일을 찾을 수 없습니다: {audio_path}")

    np = get_numpy()
    sf = get_soundfile()
    librosa = get_librosa()

    # soundfile로 오디오를 읽으면
    # "실제 파형 숫자 배열"과 "현재 샘플레이트"를 얻을 수 있다.
    waveform, sample_rate = sf.read(str(audio_path), always_2d=False)
    waveform = np.asarray(waveform, dtype=np.float32)

    if waveform.ndim == 2:
        # 스테레오(2채널)라면 좌우 채널을 평균내 mono(1채널)로 바꾼다.
        # 환경음 모델은 보통 1채널 입력을 기대하므로 이 단계가 필요하다.
        waveform = librosa.to_mono(waveform.T)

    if sample_rate != DEFAULT_SAMPLE_RATE:
        # 모델 입력 조건에 맞추기 위해 16kHz로 리샘플링한다.
        # 샘플레이트가 다르면 같은 소리라도 모델이 다르게 볼 수 있다.
        waveform = librosa.resample(
            waveform,
            orig_sr=sample_rate,
            target_sr=DEFAULT_SAMPLE_RATE,
        )
        sample_rate = DEFAULT_SAMPLE_RATE

    waveform = waveform.astype(np.float32, copy=False)

    if waveform.size == 0:
        raise ValueError(f"오디오가 비어 있습니다: {audio_path}")

    audio_duration = float(waveform.shape[0] / sample_rate)
    return waveform, audio_duration


def compute_chunk_starts(num_samples: int, chunk_samples: int, hop_samples: int) -> list[int]:
    """
    긴 오디오를 여러 청크로 나눌 때, 각 청크가 시작할 위치를 계산한다.

    예:
    - chunk = 10초
    - hop = 5초

    이 경우 시작점은 대략 0초, 5초, 10초, 15초 ... 식으로 잡힌다.
    """

    if num_samples <= chunk_samples:
        return [0]

    starts = list(range(0, max(num_samples - chunk_samples, 0) + 1, hop_samples))
    last_start = max(num_samples - chunk_samples, 0)
    if starts[-1] != last_start:
        starts.append(last_start)
    return starts


def resolve_batch_size(batch_size: int, device) -> int:
    """GPU/CPU 환경과 사용자 설정에 따라 실제 배치 크기를 결정한다."""

    if batch_size > 0:
        return batch_size
    return 8 if device.type == "cuda" else 2


def should_use_amp(device, disable_amp: bool) -> bool:
    """
    AMP(Automatic Mixed Precision) 사용 여부를 결정한다.

    쉽게 말해 GPU에서 메모리를 조금 덜 쓰고 더 빠르게 돌릴 수 있는 옵션이다.
    """

    return DEFAULT_ENABLE_AMP and device.type == "cuda" and not disable_amp


def build_chunk_frame_weights(num_frames: int, aggregation_mode: str):
    """
    겹치는 청크 결과를 다시 합칠 때 사용할 프레임 가중치를 만든다.

    `center-weighted` 모드에서는 청크 중앙을 더 믿고,
    경계 쪽은 조금 덜 믿도록 가중치를 준다.
    이유는 청크 경계 근처 예측이 상대적으로 불안정할 수 있기 때문이다.
    """

    np = get_numpy()

    if aggregation_mode == "mean" or num_frames <= 1:
        return np.ones(num_frames, dtype=np.float32)

    window = np.hanning(num_frames).astype(np.float32)
    if not window.any():
        return np.ones(num_frames, dtype=np.float32)

    return 0.25 + 0.75 * window


def run_chunked_inference(
    model,
    waveform,
    chunk_seconds: float,
    chunk_hop_seconds: float,
    device,
    batch_size: int,
    chunk_aggregation: str,
    use_amp: bool,
):
    """
    청크 단위로 모델 추론을 수행하고, 전체 오디오 길이에 맞는 프레임 logits로 합친다.

    긴 오디오를 한 번에 통째로 넣지 않고,
    "10초 청크로 자른 뒤 -> 각 청크 추론 -> 다시 전체 타임라인으로 합치기"
    방식으로 동작한다.

    이렇게 하는 이유:
    - 메모리를 아끼기 위해
    - 긴 오디오도 안정적으로 처리하기 위해
    - 청크를 일부 겹치게 보면 경계 구간 품질이 더 좋아지기 때문
    """

    torch = get_torch()
    np = get_numpy()

    # (samples,) 형태의 1차원 파형을
    # 모델이 다루기 쉬운 (1, samples) 형태의 텐서로 바꾼다.
    waveform_tensor = torch.from_numpy(waveform).unsqueeze(0)
    num_samples = int(waveform_tensor.shape[1])
    chunk_samples = int(round(chunk_seconds * DEFAULT_SAMPLE_RATE))
    hop_samples = int(round(chunk_hop_seconds * DEFAULT_SAMPLE_RATE))
    # 각 청크가 시작할 샘플 위치 목록을 계산한다.
    # 예: 0초, 5초, 10초 ... 처럼 겹치게 시작할 수 있다.
    chunk_starts = compute_chunk_starts(num_samples, chunk_samples, hop_samples)
    effective_batch_size = resolve_batch_size(batch_size, device)

    frame_resolution: Optional[float] = None
    logits_sum = None
    logits_count = None
    frame_weight_cache: dict[int, object] = {}

    with torch.inference_mode():
        for batch_start in range(0, len(chunk_starts), effective_batch_size):
            batch_chunk_starts = chunk_starts[batch_start : batch_start + effective_batch_size]
            batch_waveforms = []
            batch_valid_seconds = []

            for start_sample in batch_chunk_starts:
                end_sample = min(start_sample + chunk_samples, num_samples)
                waveform_chunk = waveform_tensor[:, start_sample:end_sample]
                valid_seconds = (end_sample - start_sample) / DEFAULT_SAMPLE_RATE

                if waveform_chunk.shape[1] < chunk_samples:
                    pad_size = chunk_samples - waveform_chunk.shape[1]
                    waveform_chunk = torch.nn.functional.pad(waveform_chunk, (0, pad_size))

                batch_waveforms.append(waveform_chunk)
                batch_valid_seconds.append(valid_seconds)

            waveform_batch = torch.cat(batch_waveforms, dim=0).to(
                device,
                non_blocking=(device.type == "cuda"),
            )

            autocast_context = (
                torch.autocast(device_type=device.type, dtype=torch.float16)
                if use_amp and device.type == "cuda"
                else nullcontext()
            )
            with autocast_context:
                mel = model.mel_forward(waveform_batch)
                strong_logits, _ = model(mel)

            batch_logits = strong_logits.transpose(1, 2).detach().float().cpu().numpy()

            if frame_resolution is None:
                frames_per_chunk = int(batch_logits.shape[1])
                frame_resolution = chunk_seconds / frames_per_chunk
                total_frames = int(math.ceil((num_samples / DEFAULT_SAMPLE_RATE) / frame_resolution))
                logits_sum = np.zeros((total_frames, batch_logits.shape[2]), dtype=np.float32)
                logits_count = np.zeros((total_frames, 1), dtype=np.float32)

            assert frame_resolution is not None
            assert logits_sum is not None
            assert logits_count is not None

            chunk_frame_weights = frame_weight_cache.setdefault(
                batch_logits.shape[1],
                build_chunk_frame_weights(batch_logits.shape[1], chunk_aggregation),
            )

            for batch_index, start_sample in enumerate(batch_chunk_starts):
                chunk_logits = batch_logits[batch_index]
                valid_seconds = batch_valid_seconds[batch_index]
                valid_frames = max(1, int(math.ceil(valid_seconds / frame_resolution)))
                valid_frames = min(valid_frames, chunk_logits.shape[0])
                start_frame = int(round((start_sample / DEFAULT_SAMPLE_RATE) / frame_resolution))
                end_frame = min(start_frame + valid_frames, logits_sum.shape[0])
                usable_frames = end_frame - start_frame

                if usable_frames <= 0:
                    continue

                frame_weights = chunk_frame_weights[:usable_frames, None]
                logits_sum[start_frame:end_frame] += chunk_logits[:usable_frames] * frame_weights
                logits_count[start_frame:end_frame] += frame_weights

    if logits_sum is None or logits_count is None or frame_resolution is None:
        raise RuntimeError("추론 결과가 비어 있습니다.")

    logits_count = np.clip(logits_count, a_min=1e-6, a_max=None)
    averaged_logits = logits_sum / logits_count
    return averaged_logits, frame_resolution


def sigmoid_probabilities(logits):
    """logits를 0~1 확률로 변환한다."""

    np = get_numpy()
    return 1.0 / (1.0 + np.exp(-logits))


def smooth_probabilities(probabilities, window_size: int):
    """median filter로 확률 시퀀스를 부드럽게 만든다."""

    if window_size <= 1:
        return probabilities
    median_filter = get_median_filter()
    return median_filter(probabilities, size=(window_size, 1), mode="nearest")


def should_enable_transient_pass(args: argparse.Namespace) -> bool:
    """짧은 충격음 회수용 transient pass 사용 여부를 결정한다."""

    if args.disable_transient_pass:
        return False
    if args.detection_profile == "accessibility":
        return DEFAULT_ENABLE_TRANSIENT_PASS
    return False


def find_contiguous_regions(active_mask) -> Iterable[tuple[int, int]]:
    """활성/비활성 마스크에서 연속 구간을 찾는다."""

    np = get_numpy()

    if active_mask.ndim != 1:
        raise ValueError("active_mask는 1차원 배열이어야 합니다.")
    if active_mask.size == 0:
        return []

    changes = np.diff(active_mask.astype(np.int8))
    starts = np.where(changes == 1)[0] + 1
    ends = np.where(changes == -1)[0] + 1

    if active_mask[0]:
        starts = np.r_[0, starts]
    if active_mask[-1]:
        ends = np.r_[ends, active_mask.size]

    return list(zip(starts.tolist(), ends.tolist()))


def find_hysteresis_regions(probabilities_1d, onset_threshold: float, release_threshold: float):
    """on/off 임계값을 다르게 쓰는 hysteresis 방식으로 활성 구간을 찾는다."""

    if probabilities_1d.ndim != 1:
        raise ValueError("probabilities_1d는 1차원 배열이어야 합니다.")
    if probabilities_1d.size == 0:
        return []

    release_threshold = min(release_threshold, onset_threshold)
    regions: list[tuple[int, int]] = []
    start_frame: Optional[int] = None

    for frame_index, score in enumerate(probabilities_1d):
        score = float(score)
        if start_frame is None:
            if score >= onset_threshold:
                start_frame = frame_index
            continue

        if score < release_threshold:
            regions.append((start_frame, frame_index))
            start_frame = None

    if start_frame is not None:
        regions.append((start_frame, probabilities_1d.shape[0]))

    return regions


def frame_to_seconds(frame_index: int, frame_resolution: float, audio_duration: float) -> float:
    """프레임 인덱스를 초 단위 시간으로 변환한다."""

    return min(frame_index * frame_resolution, audio_duration)


def decode_events(
    active_probabilities,
    score_probabilities,
    labels: Sequence[str],
    threshold: float,
    release_threshold_ratio: float,
    frame_resolution: float,
    audio_duration: float,
    min_event_duration: float,
    min_event_peak: float,
    min_event_mean: float,
    label_threshold_overrides: Optional[dict[str, float]] = None,
    label_min_peak_overrides: Optional[dict[str, float]] = None,
    label_min_mean_overrides: Optional[dict[str, float]] = None,
    label_min_duration_overrides: Optional[dict[str, float]] = None,
) -> list[DetectedEvent]:
    """
    프레임 단위 확률 배열을 사람이 이해할 수 있는 이벤트 목록으로 변환한다.

    모델은 매 프레임마다
    "이 소리일 가능성이 얼마나 높은가"만 알려 준다.
    이 함수는 그 숫자들을 이어 붙여
    "몇 초부터 몇 초까지 어떤 소리"라는 구간 이벤트로 바꾸는 핵심 단계다.

    여기서 하는 대표 작업:
    - threshold 넘는 구간 찾기
    - 시작/끝 시각 계산하기
    - 너무 짧거나 너무 약한 이벤트 버리기
    """

    if active_probabilities.shape != score_probabilities.shape:
        raise ValueError("active_probabilities와 score_probabilities의 shape가 다릅니다.")
    if active_probabilities.shape[1] != len(labels):
        raise ValueError("확률 배열 길이와 라벨 수가 맞지 않습니다.")

    label_threshold_overrides = label_threshold_overrides or {}
    label_min_peak_overrides = label_min_peak_overrides or {}
    label_min_mean_overrides = label_min_mean_overrides or {}
    label_min_duration_overrides = label_min_duration_overrides or {}

    events: list[DetectedEvent] = []

    for class_index, label in enumerate(labels):
        current_threshold = label_threshold_overrides.get(label, threshold)
        current_min_peak = label_min_peak_overrides.get(label, min_event_peak)
        current_min_mean = label_min_mean_overrides.get(label, min_event_mean)
        current_min_duration = label_min_duration_overrides.get(label, min_event_duration)
        current_release_threshold = current_threshold * release_threshold_ratio
        active_regions = find_hysteresis_regions(
            active_probabilities[:, class_index],
            onset_threshold=current_threshold,
            release_threshold=current_release_threshold,
        )

        for start_frame, end_frame in active_regions:
            onset = frame_to_seconds(start_frame, frame_resolution, audio_duration)
            offset = frame_to_seconds(end_frame, frame_resolution, audio_duration)
            duration = offset - onset

            if duration < current_min_duration:
                continue

            event_scores = score_probabilities[start_frame:end_frame, class_index]
            if event_scores.size == 0:
                continue

            max_confidence = float(event_scores.max())
            mean_confidence = float(event_scores.mean())

            if max_confidence < current_min_peak:
                continue
            if mean_confidence < current_min_mean:
                continue

            events.append(
                DetectedEvent(
                    event_label=label,
                    onset=round(onset, 2),
                    offset=round(offset, 2),
                    duration=round(duration, 2),
                    max_confidence=max_confidence,
                    mean_confidence=mean_confidence,
                )
            )

    events.sort(key=lambda item: (item.onset, item.offset, item.event_label))
    return events


def detect_events_with_pass(
    probabilities,
    labels: Sequence[str],
    frame_resolution: float,
    audio_duration: float,
    threshold: float,
    release_threshold_ratio: float,
    median_window: int,
    min_event_duration: float,
    min_event_peak: float,
    min_event_mean: float,
    label_thresholds: dict[str, float],
    label_min_peak: dict[str, float],
    label_min_mean: dict[str, float],
    label_min_duration: dict[str, float],
) -> list[DetectedEvent]:
    """
    한 번의 후처리 pass로 이벤트를 추출한다.

    보통 순서는 아래와 같다.
    1. median filter로 프레임 점수를 조금 부드럽게 만든다.
    2. threshold를 이용해 활성 구간을 찾는다.
    3. onset/offset을 계산해 이벤트 목록으로 바꾼다.

    본 스크립트에서는
    - 기본 pass
    - transient(짧은 소리 전용) pass
    가 각각 이 함수를 사용한다.
    """

    active_probabilities = smooth_probabilities(probabilities, median_window)
    return decode_events(
        active_probabilities=active_probabilities,
        score_probabilities=probabilities,
        labels=labels,
        threshold=threshold,
        release_threshold_ratio=release_threshold_ratio,
        frame_resolution=frame_resolution,
        audio_duration=audio_duration,
        min_event_duration=min_event_duration,
        min_event_peak=min_event_peak,
        min_event_mean=min_event_mean,
        label_threshold_overrides=label_thresholds,
        label_min_peak_overrides=label_min_peak,
        label_min_mean_overrides=label_min_mean,
        label_min_duration_overrides=label_min_duration,
    )


def combine_event_lists(*event_lists: Sequence[DetectedEvent]) -> list[DetectedEvent]:
    """여러 pass에서 나온 이벤트 목록을 합친다."""

    combined: list[DetectedEvent] = []
    for events in event_lists:
        combined.extend(events)
    combined.sort(key=lambda item: (item.onset, item.offset, item.event_label))
    return combined


def merge_adjacent_events(events: Sequence[DetectedEvent], merge_gap: float) -> list[DetectedEvent]:
    """같은 라벨의 인접 이벤트를 병합한다."""

    if not events or merge_gap <= 0.0:
        return list(events)

    merged: list[DetectedEvent] = []
    for event in sorted(events, key=lambda item: (item.event_label, item.onset, item.offset)):
        if not merged:
            merged.append(event)
            continue

        prev = merged[-1]
        is_same_label = prev.event_label == event.event_label
        gap = event.onset - prev.offset

        if is_same_label and gap <= merge_gap:
            total_duration = max(prev.duration + event.duration, 1e-6)
            merged[-1] = DetectedEvent(
                event_label=prev.event_label,
                onset=prev.onset,
                offset=max(prev.offset, event.offset),
                duration=round(max(prev.offset, event.offset) - prev.onset, 2),
                max_confidence=max(prev.max_confidence, event.max_confidence),
                mean_confidence=(
                    (prev.mean_confidence * prev.duration + event.mean_confidence * event.duration)
                    / total_duration
                ),
            )
        else:
            merged.append(event)

    merged.sort(key=lambda item: (item.onset, item.offset, item.event_label))
    return merged


def collapse_human_voice_events(events: Sequence[DetectedEvent]) -> list[DetectedEvent]:
    """사람 목소리 계열 라벨을 하나로 통합한다."""

    remapped_events: list[DetectedEvent] = []
    for event in events:
        if event.event_label in HUMAN_VOICE_LABELS:
            remapped_events.append(
                DetectedEvent(
                    event_label=COLLAPSED_HUMAN_VOICE_LABEL,
                    onset=event.onset,
                    offset=event.offset,
                    duration=event.duration,
                    max_confidence=event.max_confidence,
                    mean_confidence=event.mean_confidence,
                )
            )
        else:
            remapped_events.append(event)

    return merge_adjacent_events(remapped_events, merge_gap=0.20)


def filter_excluded_events(events: Sequence[DetectedEvent], excluded_labels: set[str]) -> list[DetectedEvent]:
    """제외 라벨 목록에 포함된 이벤트를 제거한다."""

    if not excluded_labels:
        return list(events)
    return [event for event in events if event.event_label not in excluded_labels]


def filter_caption_mapped_events(
    events: Sequence[DetectedEvent],
    caption_overrides: dict[str, str],
) -> list[DetectedEvent]:
    """서비스 자막 매핑이 있는 raw label만 남긴다."""

    if not caption_overrides:
        return list(events)

    return [event for event in events if event.event_label in caption_overrides]


def merge_events_by_caption_label(
    events: Sequence[DetectedEvent],
    translations: dict[str, str],
    caption_overrides: dict[str, str],
    merge_gap: float,
) -> list[DetectedEvent]:
    """같은 최종 자막 문구로 보이는 이벤트를 한 번 더 병합한다."""

    if not events:
        return []

    grouped: dict[str, list[DetectedEvent]] = {}
    for event in events:
        caption_label = resolve_caption_label(event.event_label, translations, caption_overrides)
        grouped.setdefault(caption_label, []).append(event)

    merged_events: list[DetectedEvent] = []
    for _caption_label, caption_events in grouped.items():
        caption_events = sorted(caption_events, key=lambda item: (item.onset, item.offset, item.event_label))
        current = caption_events[0]

        for event in caption_events[1:]:
            gap = event.onset - current.offset
            if gap <= merge_gap:
                current_duration = max(current.duration, 1e-6)
                event_duration = max(event.duration, 1e-6)
                total_duration = current_duration + event_duration

                representative_label = current.event_label
                if event.max_confidence > current.max_confidence:
                    representative_label = event.event_label

                merged_onset = min(current.onset, event.onset)
                merged_offset = max(current.offset, event.offset)
                current = DetectedEvent(
                    event_label=representative_label,
                    onset=merged_onset,
                    offset=merged_offset,
                    duration=round(max(0.0, merged_offset - merged_onset), 2),
                    max_confidence=max(current.max_confidence, event.max_confidence),
                    mean_confidence=(
                        (current.mean_confidence * current_duration + event.mean_confidence * event_duration)
                        / total_duration
                    ),
                )
            else:
                merged_events.append(current)
                current = event

        merged_events.append(current)

    merged_events.sort(key=lambda item: (item.onset, item.offset, item.event_label))
    return merged_events


def build_caption_probability_view(
    probabilities,
    labels: Sequence[str],
    translations: dict[str, str],
    caption_overrides: dict[str, str],
    excluded_labels: Optional[set[str]] = None,
):
    """raw label 확률을 최종 자막 문구 단위의 확률로 다시 묶는다.

    caption override가 있는 라벨은 서비스 자막 문구로 통합하고,
    override가 없는 라벨은 한국어 번역 또는 원래 라벨로 그대로 남긴다.
    이렇게 해야 일부만 선별 매핑한 상태에서도 결과가 지나치게 비어 버리지 않는다.
    """

    np = get_numpy()
    excluded_labels = excluded_labels or set()

    caption_labels: list[str] = []
    caption_to_indices: dict[str, list[int]] = {}
    caption_to_raw_labels: dict[str, list[str]] = {}

    for class_index, label in enumerate(labels):
        if label in excluded_labels:
            continue

        caption_label = resolve_caption_label(label, translations, caption_overrides)
        if caption_label not in caption_to_indices:
            caption_labels.append(caption_label)
            caption_to_indices[caption_label] = []
            caption_to_raw_labels[caption_label] = []

        caption_to_indices[caption_label].append(class_index)
        caption_to_raw_labels[caption_label].append(label)

    if not caption_labels:
        empty = np.zeros((probabilities.shape[0], 0), dtype=probabilities.dtype)
        return empty, caption_labels, caption_to_raw_labels

    caption_probabilities = np.zeros((probabilities.shape[0], len(caption_labels)), dtype=probabilities.dtype)
    for caption_index, caption_label in enumerate(caption_labels):
        raw_indices = caption_to_indices[caption_label]
        if len(raw_indices) == 1:
            caption_probabilities[:, caption_index] = probabilities[:, raw_indices[0]]
        else:
            caption_probabilities[:, caption_index] = probabilities[:, raw_indices].max(axis=1)

    return caption_probabilities, caption_labels, caption_to_raw_labels


def project_label_value_overrides_to_captions(
    caption_to_raw_labels: dict[str, list[str]],
    raw_overrides: dict[str, float],
) -> dict[str, float]:
    """raw label override를 자막 문구 단위 override로 변환한다."""

    projected: dict[str, float] = {}
    for caption_label, raw_labels in caption_to_raw_labels.items():
        values = [raw_overrides[label] for label in raw_labels if label in raw_overrides]
        if values:
            projected[caption_label] = min(values)
    return projected


def build_event_from_frame_span(
    label: str,
    scores_1d,
    start_frame: int,
    end_frame: int,
    frame_resolution: float,
    audio_duration: float,
) -> Optional[DetectedEvent]:
    """프레임 구간과 1차원 점수 벡터로부터 이벤트 객체를 다시 만든다."""

    if end_frame <= start_frame:
        return None

    event_scores = scores_1d[start_frame:end_frame]
    if event_scores.size == 0:
        return None

    onset = frame_to_seconds(start_frame, frame_resolution, audio_duration)
    offset = frame_to_seconds(end_frame, frame_resolution, audio_duration)
    duration = offset - onset
    if duration <= 0.0:
        return None

    return DetectedEvent(
        event_label=label,
        onset=round(onset, 2),
        offset=round(offset, 2),
        duration=round(duration, 2),
        max_confidence=float(event_scores.max()),
        mean_confidence=float(event_scores.mean()),
    )


def split_events_on_internal_dips(
    events: Sequence[DetectedEvent],
    score_probabilities,
    labels: Sequence[str],
    base_threshold: float,
    frame_resolution: float,
    audio_duration: float,
    min_event_duration: float,
    min_split_duration: float = DEFAULT_CAPTION_SPLIT_MIN_DURATION,
    min_gap_seconds: float = DEFAULT_CAPTION_SPLIT_MIN_GAP_SECONDS,
    split_threshold_ratio: float = DEFAULT_CAPTION_SPLIT_THRESHOLD_RATIO,
    split_release_ratio: float = DEFAULT_CAPTION_SPLIT_RELEASE_RATIO,
) -> list[DetectedEvent]:
    """긴 이벤트 내부에 의미 있는 점수 하락 구간이 있으면 여러 조각으로 다시 나눈다."""

    if not events:
        return []

    label_to_index = {label: index for index, label in enumerate(labels)}
    min_gap_frames = max(1, int(math.ceil(min_gap_seconds / frame_resolution)))
    split_events: list[DetectedEvent] = []

    for event in events:
        if event.duration < min_split_duration:
            split_events.append(event)
            continue

        label_index = label_to_index.get(event.event_label)
        if label_index is None:
            split_events.append(event)
            continue

        start_frame = max(0, int(math.floor(event.onset / frame_resolution)))
        end_frame = min(score_probabilities.shape[0], int(math.ceil(event.offset / frame_resolution)))
        if end_frame - start_frame <= 1:
            split_events.append(event)
            continue

        label_scores = score_probabilities[:, label_index]
        window_scores = label_scores[start_frame:end_frame]
        split_threshold = max(
            base_threshold * split_threshold_ratio,
            min(0.80, max(event.mean_confidence * 1.05, event.max_confidence * 0.65)),
        )
        split_release_threshold = min(split_threshold, split_threshold * split_release_ratio)
        subregions = find_hysteresis_regions(
            window_scores,
            onset_threshold=split_threshold,
            release_threshold=split_release_threshold,
        )

        if len(subregions) <= 1:
            split_events.append(event)
            continue

        merged_regions: list[tuple[int, int]] = []
        for relative_start, relative_end in subregions:
            absolute_start = start_frame + relative_start
            absolute_end = start_frame + relative_end
            region_duration = (absolute_end - absolute_start) * frame_resolution
            if region_duration < min_event_duration:
                continue

            if merged_regions and absolute_start - merged_regions[-1][1] < min_gap_frames:
                prev_start, _prev_end = merged_regions[-1]
                merged_regions[-1] = (prev_start, absolute_end)
            else:
                merged_regions.append((absolute_start, absolute_end))

        if len(merged_regions) <= 1:
            split_events.append(event)
            continue

        rebuilt_any = False
        for absolute_start, absolute_end in merged_regions:
            rebuilt = build_event_from_frame_span(
                event.event_label,
                label_scores,
                absolute_start,
                absolute_end,
                frame_resolution,
                audio_duration,
            )
            if rebuilt is None or rebuilt.duration < min_event_duration:
                continue
            split_events.append(rebuilt)
            rebuilt_any = True

        if not rebuilt_any:
            split_events.append(event)

    split_events.sort(key=lambda item: (item.onset, item.offset, item.event_label))
    return split_events


def _event_priority_key(event: DetectedEvent, support_counts: dict[str, int]) -> tuple[float, float, float, float]:
    """겹침 억제 시 어떤 자막을 더 우선할지 비교하는 우선순위 키."""

    support_count = float(support_counts.get(event.event_label, 1))
    return (
        support_count,
        -event.max_confidence,
        -event.mean_confidence,
        -event.duration,
    )


def _should_suppress_overlapped_event(
    candidate: DetectedEvent,
    anchor: DetectedEvent,
    support_counts: dict[str, int],
    overlap_seconds: float,
    overlap_ratio: float,
) -> bool:
    """겹치는 두 이벤트 중 candidate를 숨겨도 되는지 판단한다."""

    candidate_duration = max(candidate.duration, 1e-6)
    if overlap_seconds / candidate_duration < overlap_ratio:
        return False

    if _event_priority_key(anchor, support_counts) >= _event_priority_key(candidate, support_counts):
        return False

    return anchor.max_confidence >= (candidate.max_confidence - 0.08)


def suppress_overlapping_events(
    events: Sequence[DetectedEvent],
    support_counts: dict[str, int],
    overlap_ratio: float = DEFAULT_CAPTION_OVERLAP_RATIO,
) -> list[DetectedEvent]:
    """짧고 거의 완전히 겹치는 낮은 우선순위 자막을 숨긴다."""

    if not events:
        return []

    ordered_events = sorted(events, key=lambda item: (item.onset, item.offset, item.event_label))
    suppressed = [False] * len(ordered_events)

    for index, event in enumerate(ordered_events):
        if suppressed[index]:
            continue

        for other_index in range(index + 1, len(ordered_events)):
            if suppressed[other_index]:
                continue

            other = ordered_events[other_index]
            if other.onset >= event.offset:
                break

            overlap_seconds = min(event.offset, other.offset) - max(event.onset, other.onset)
            if overlap_seconds <= 0.0:
                continue

            if _should_suppress_overlapped_event(
                candidate=event,
                anchor=other,
                support_counts=support_counts,
                overlap_seconds=overlap_seconds,
                overlap_ratio=overlap_ratio,
            ):
                suppressed[index] = True
                break

            if _should_suppress_overlapped_event(
                candidate=other,
                anchor=event,
                support_counts=support_counts,
                overlap_seconds=overlap_seconds,
                overlap_ratio=overlap_ratio,
            ):
                suppressed[other_index] = True

    return [event for keep, event in zip([not item for item in suppressed], ordered_events) if keep]


def assign_representative_raw_labels(
    caption_events: Sequence[DetectedEvent],
    caption_to_raw_labels: dict[str, list[str]],
    raw_labels: Sequence[str],
    raw_probabilities,
    frame_resolution: float,
) -> list[DetectedEvent]:
    """caption 단위 이벤트를 가장 대표적인 raw label로 다시 매핑한다."""

    raw_label_to_index = {label: index for index, label in enumerate(raw_labels)}
    remapped_events: list[DetectedEvent] = []

    for event in caption_events:
        candidate_raw_labels = caption_to_raw_labels.get(event.event_label, [])
        if not candidate_raw_labels:
            remapped_events.append(event)
            continue

        start_frame = max(0, int(math.floor(event.onset / frame_resolution)))
        end_frame = min(raw_probabilities.shape[0], int(math.ceil(event.offset / frame_resolution)))
        representative_label = candidate_raw_labels[0]
        representative_key = (-1.0, -1.0)

        for raw_label in candidate_raw_labels:
            raw_index = raw_label_to_index.get(raw_label)
            if raw_index is None:
                continue

            raw_scores = raw_probabilities[start_frame:end_frame, raw_index]
            if raw_scores.size == 0:
                continue

            score_key = (float(raw_scores.max()), float(raw_scores.mean()))
            if score_key > representative_key:
                representative_key = score_key
                representative_label = raw_label

        remapped_events.append(
            DetectedEvent(
                event_label=representative_label,
                onset=event.onset,
                offset=event.offset,
                duration=event.duration,
                max_confidence=event.max_confidence,
                mean_confidence=event.mean_confidence,
            )
        )

    remapped_events.sort(key=lambda item: (item.onset, item.offset, item.event_label))
    return remapped_events


def print_timeline(
    events: Sequence[DetectedEvent],
    translations: dict[str, str],
    caption_overrides: dict[str, str],
    timeline_language: str = DEFAULT_TIMELINE_LANGUAGE,
) -> None:
    """이벤트 목록을 자막 타임라인 형식으로 출력한다."""

    if not events:
        print("감지된 환경음 이벤트가 없습니다.")
        return

    for event in events:
        display_label = format_event_label_for_display(
            event,
            translations=translations,
            caption_overrides=caption_overrides,
            language=timeline_language,
        )
        print(f"[{event.onset:.2f}s ~ {event.offset:.2f}s] {display_label}")


def save_events_json(
    events: Sequence[DetectedEvent],
    output_path: Path,
    translations: dict[str, str],
    caption_overrides: dict[str, str],
) -> None:
    """이벤트 결과를 JSON 파일로 저장한다."""

    output_path = output_path.expanduser().resolve()
    output_path.parent.mkdir(parents=True, exist_ok=True)
    payload = [serialize_event(event, translations, caption_overrides) for event in events]
    with output_path.open("w", encoding="utf-8") as file:
        json.dump(payload, file, ensure_ascii=False, indent=2)


def save_events_csv(
    events: Sequence[DetectedEvent],
    output_path: Path,
    translations: dict[str, str],
    caption_overrides: dict[str, str],
) -> None:
    """이벤트 결과를 CSV 파일로 저장한다."""

    output_path = output_path.expanduser().resolve()
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8", newline="") as file:
        writer = csv.DictWriter(
            file,
            fieldnames=[
                "event_label",
                "label_en",
                "label_ko",
                "caption_label",
                "onset",
                "offset",
                "duration",
                "max_confidence",
                "mean_confidence",
            ],
        )
        writer.writeheader()
        for event in events:
            writer.writerow(serialize_event(event, translations, caption_overrides))


def main() -> None:
    """
    전체 파이프라인을 처음부터 끝까지 실행하는 시작점이다.

    이 함수 하나를 기준으로 보면 스크립트 흐름이 거의 다 보인다.

    1. 명령줄 옵션과 JSON 설정 파일 읽기
    2. 모델 준비
    3. 오디오 로드
    4. 프레임 단위 추론
    5. 이벤트 추출
    6. 자막 서비스용 후처리
    7. 화면 / JSON / CSV 출력
    """

    # ------------------------------------------------------------------
    # 1) 명령줄 옵션과 JSON 설정 파일 읽기
    # ------------------------------------------------------------------
    # - 어떤 오디오를 읽을지
    # - 어떤 자막 라벨 파일을 쓸지
    # - 어떤 후처리 규칙을 적용할지
    # 를 먼저 준비한다.
    args = parse_args()
    postprocess_config = load_postprocess_config(args.postprocess_config)
    label_translation_path = getattr(args, "label_translation_config", None) or resolve_default_label_translation_path()
    label_translations = load_label_translation_map(label_translation_path)
    caption_label_path = getattr(args, "caption_label_config", None)
    grouped_caption_label_path: Optional[Path] = None
    if caption_label_path is not None:
        # 사용자가 caption JSON을 직접 지정했다면 그 파일만 사용한다.
        caption_label_overrides = load_label_translation_map(caption_label_path)
    else:
        # 별도 지정이 없으면 스크립트 옆의 기본 caption JSON을 읽는다.
        # 예전 grouped caption 파일이 남아 있으면 추가 override로만 합친다.
        caption_label_path = resolve_default_caption_label_path()
        grouped_caption_label_path = resolve_default_grouped_caption_label_path()
        caption_label_overrides = load_label_translation_map(caption_label_path)
        if grouped_caption_label_path is not None and grouped_caption_label_path.exists():
            caption_label_overrides.update(load_label_translation_map(grouped_caption_label_path))
    timeline_language = getattr(
        args,
        "timeline_language",
        "ko" if label_translations else DEFAULT_TIMELINE_LANGUAGE,
    )
    quiet = getattr(args, "quiet", False)
    # ------------------------------------------------------------------
    # 2) CPU / GPU 선택
    # ------------------------------------------------------------------
    device = resolve_device(args.device)
    use_amp = should_use_amp(device, args.disable_amp)

    if device.type == "cuda":
        torch = get_torch()
        if hasattr(torch.backends, "cudnn"):
            torch.backends.cudnn.benchmark = True

    # ------------------------------------------------------------------
    # 3) 체크포인트를 포함한 모델 로드
    # ------------------------------------------------------------------
    model, class_labels, resolved_checkpoint = build_model(
        pretrainedsed_root=args.pretrainedsed_root,
        checkpoint_name=args.checkpoint_name,
        checkpoint_path=args.checkpoint_path,
        resources_dir=args.resources_dir,
        device=device,
    )

    # ------------------------------------------------------------------
    # 4) 입력 오디오를 모델 형식(16kHz mono)으로 로드
    # ------------------------------------------------------------------
    waveform, audio_duration = load_audio(args.audio_file)

    # ------------------------------------------------------------------
    # 5) 긴 오디오를 청크로 잘라 프레임 단위 logits를 얻는다
    # ------------------------------------------------------------------
    logits, frame_resolution = run_chunked_inference(
        model=model,
        waveform=waveform,
        chunk_seconds=args.chunk_seconds,
        chunk_hop_seconds=args.chunk_hop_seconds,
        device=device,
        batch_size=args.batch_size,
        chunk_aggregation=args.chunk_aggregation,
        use_amp=use_amp,
    )

    # ------------------------------------------------------------------
    # 6) logits를 0~1 범위 값으로 변환
    # ------------------------------------------------------------------
    # 이 단계부터는 "점수가 높을수록 그 소리일 가능성이 높다"라고 생각하면 된다.
    probabilities = sigmoid_probabilities(logits)

    label_thresholds = merge_override_maps(postprocess_config["label_thresholds"], args.label_threshold_map)
    label_min_peak = merge_override_maps(postprocess_config["label_min_peak"], args.label_min_peak_map)
    label_min_mean = merge_override_maps(postprocess_config["label_min_mean"], args.label_min_mean_map)
    label_min_duration = merge_override_maps(
        postprocess_config["label_min_duration"],
        args.label_min_duration_map,
    )

    excluded_labels = set(postprocess_config["exclude_labels"])
    excluded_labels.update(args.exclude_label)

    if args.suppress_generic_labels:
        excluded_labels.update(GENERIC_ENVIRONMENT_LABELS)

    if args.suppress_human_voice:
        excluded_labels.update(HUMAN_VOICE_LABELS)
        excluded_labels.add(COLLAPSED_HUMAN_VOICE_LABEL)

    # ------------------------------------------------------------------
    # 7) 모델 확률을 실제 이벤트 구간으로 바꾸는 단계
    # ------------------------------------------------------------------
    # caption label 기준으로 바로 이벤트를 만들 수 있으면 그렇게 처리한다.
    # 이렇게 하면 같은 자막으로 묶인 raw label들을 더 자연스럽게 다룰 수 있다.
    if caption_label_overrides:
        caption_probabilities, caption_labels, caption_to_raw_labels = build_caption_probability_view(
            probabilities=probabilities,
            labels=class_labels,
            translations=label_translations,
            caption_overrides=caption_label_overrides,
            excluded_labels=excluded_labels,
        )

        if caption_labels:
            caption_thresholds = project_label_value_overrides_to_captions(caption_to_raw_labels, label_thresholds)
            caption_min_peak = project_label_value_overrides_to_captions(caption_to_raw_labels, label_min_peak)
            caption_min_mean = project_label_value_overrides_to_captions(caption_to_raw_labels, label_min_mean)
            caption_min_duration = project_label_value_overrides_to_captions(caption_to_raw_labels, label_min_duration)

            primary_events = detect_events_with_pass(
                probabilities=caption_probabilities,
                labels=caption_labels,
                frame_resolution=frame_resolution,
                audio_duration=audio_duration,
                threshold=args.threshold,
                release_threshold_ratio=args.release_threshold_ratio,
                median_window=args.median_window,
                min_event_duration=args.min_event_duration,
                min_event_peak=args.min_event_peak,
                min_event_mean=args.min_event_mean,
                label_thresholds=caption_thresholds,
                label_min_peak=caption_min_peak,
                label_min_mean=caption_min_mean,
                label_min_duration=caption_min_duration,
            )

            if should_enable_transient_pass(args):
                transient_events = detect_events_with_pass(
                    probabilities=caption_probabilities,
                    labels=caption_labels,
                    frame_resolution=frame_resolution,
                    audio_duration=audio_duration,
                    threshold=args.transient_threshold,
                    release_threshold_ratio=args.release_threshold_ratio,
                    median_window=args.transient_median_window,
                    min_event_duration=args.transient_min_event_duration,
                    min_event_peak=args.transient_min_event_peak,
                    min_event_mean=args.transient_min_event_mean,
                    label_thresholds=caption_thresholds,
                    label_min_peak=caption_min_peak,
                    label_min_mean=caption_min_mean,
                    label_min_duration=caption_min_duration,
                )
                events = combine_event_lists(primary_events, transient_events)
            else:
                events = primary_events

            events = merge_adjacent_events(events, args.merge_gap)
            events = split_events_on_internal_dips(
                events=events,
                score_probabilities=caption_probabilities,
                labels=caption_labels,
                base_threshold=args.threshold,
                frame_resolution=frame_resolution,
                audio_duration=audio_duration,
                min_event_duration=args.min_event_duration,
            )
            events = merge_adjacent_events(events, args.merge_gap)
            events = assign_representative_raw_labels(
                caption_events=events,
                caption_to_raw_labels=caption_to_raw_labels,
                raw_labels=class_labels,
                raw_probabilities=probabilities,
                frame_resolution=frame_resolution,
            )
        else:
            events = []
    else:
        primary_events = detect_events_with_pass(
            probabilities=probabilities,
            labels=class_labels,
            frame_resolution=frame_resolution,
            audio_duration=audio_duration,
            threshold=args.threshold,
            release_threshold_ratio=args.release_threshold_ratio,
            median_window=args.median_window,
            min_event_duration=args.min_event_duration,
            min_event_peak=args.min_event_peak,
            min_event_mean=args.min_event_mean,
            label_thresholds=label_thresholds,
            label_min_peak=label_min_peak,
            label_min_mean=label_min_mean,
            label_min_duration=label_min_duration,
        )

        if should_enable_transient_pass(args):
            transient_events = detect_events_with_pass(
                probabilities=probabilities,
                labels=class_labels,
                frame_resolution=frame_resolution,
                audio_duration=audio_duration,
                threshold=args.transient_threshold,
                release_threshold_ratio=args.release_threshold_ratio,
                median_window=args.transient_median_window,
                min_event_duration=args.transient_min_event_duration,
                min_event_peak=args.transient_min_event_peak,
                min_event_mean=args.transient_min_event_mean,
                label_thresholds=label_thresholds,
                label_min_peak=label_min_peak,
                label_min_mean=label_min_mean,
                label_min_duration=label_min_duration,
            )
            events = combine_event_lists(primary_events, transient_events)
        else:
            events = primary_events

        events = merge_adjacent_events(events, args.merge_gap)

        if args.collapse_human_voice:
            events = collapse_human_voice_events(events)

        events = filter_excluded_events(events, excluded_labels)
        events = filter_caption_mapped_events(events, caption_label_overrides)
        events = merge_events_by_caption_label(
            events,
            translations=label_translations,
            caption_overrides=caption_label_overrides,
            merge_gap=args.merge_gap,
        )

    # 디버그 출력용으로는 "자막 후처리 전" 이벤트 목록을 따로 보관한다.
    raw_events_for_debug = list(events)

    if not args.disable_subtitle_postprocess:
        # ------------------------------------------------------------------
        # 8) 서비스 자막용 추가 후처리
        # ------------------------------------------------------------------
        # 여기서는 "모델이 찾은 이벤트"를
        # "사용자가 실제로 읽게 될 자막"에 더 가깝게 다듬는다.
        #
        # 대표 작업:
        # - 같은 자막 병합
        # - 너무 짧은 자막 제거
        # - 반복형 소리 묶기
        subtitle_events = build_subtitle_events(
            events,
            translations=label_translations,
            caption_overrides=caption_label_overrides,
        )
        subtitle_events = subtitle_postprocess(
            subtitle_events,
            default_merge_gap=args.subtitle_merge_gap,
            default_min_duration=args.subtitle_min_duration,
        )
        events = subtitle_events_to_detected_events(subtitle_events)

    # ------------------------------------------------------------------
    # 9) 사람이 읽을 로그 / 타임라인 출력
    # ------------------------------------------------------------------
    if not quiet:
        print(f"입력 파일: {args.audio_file.expanduser().resolve()}")
        print(f"체크포인트: {resolved_checkpoint}")
        print(f"오디오 길이: {audio_duration:.2f}초")
        print(f"추론 장치: {device}")
        print(f"프로필: {args.detection_profile}")
        print(f"프레임 해상도: {frame_resolution:.3f}초/frame")
        print(f"Threshold: {args.threshold:.2f}")
        print(f"Release ratio: {args.release_threshold_ratio:.2f}")
        print(f"Min peak / mean: {args.min_event_peak:.2f} / {args.min_event_mean:.2f}")
        print(f"Batch size: {resolve_batch_size(args.batch_size, device)}")
        print(f"Chunk aggregation: {args.chunk_aggregation}")
        print(f"AMP: {'on' if use_amp else 'off'}")
        print(f"Transient pass: {'on' if should_enable_transient_pass(args) else 'off'}")
        print(f"Subtitle postprocess: {'on' if not args.disable_subtitle_postprocess else 'off'}")
        if args.postprocess_config is not None:
            print(f"후처리 설정: {args.postprocess_config.expanduser().resolve()}")
        if label_translation_path is not None:
            print(f"라벨 번역 설정: {Path(label_translation_path).expanduser().resolve()}")
        if caption_label_path is not None:
            print(f"자막 라벨 설정: {Path(caption_label_path).expanduser().resolve()}")
        if grouped_caption_label_path is not None:
            print(f"추가 자막 라벨 설정: {Path(grouped_caption_label_path).expanduser().resolve()}")
        print("-" * 80)
        print_probability_debug(
            probabilities=probabilities,
            labels=class_labels,
            events=raw_events_for_debug,
            translations=label_translations,
            caption_overrides=caption_label_overrides,
            frame_resolution=frame_resolution,
            top_k=args.debug_top_k,
            excluded_labels=excluded_labels,
        )

    print_timeline(
        events,
        translations=label_translations,
        caption_overrides=caption_label_overrides,
        timeline_language=timeline_language,
    )

    # ------------------------------------------------------------------
    # 10) 필요하면 JSON / CSV 파일 저장
    # ------------------------------------------------------------------
    if args.json_out is not None:
        save_events_json(
            events,
            args.json_out,
            translations=label_translations,
            caption_overrides=caption_label_overrides,
        )
        if not quiet:
            print(f"\nJSON 저장 완료: {args.json_out.expanduser().resolve()}")

    if args.csv_out is not None:
        save_events_csv(
            events,
            args.csv_out,
            translations=label_translations,
            caption_overrides=caption_label_overrides,
        )
        if not quiet:
            print(f"CSV 저장 완료: {args.csv_out.expanduser().resolve()}")


if __name__ == "__main__":
    main()
