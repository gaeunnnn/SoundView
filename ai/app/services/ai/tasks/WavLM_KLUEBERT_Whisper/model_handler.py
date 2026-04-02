# model_handler.py — 하위 호환성 유지용 re-export 모듈
#
# SubtitleModel과 VibrationModel은 각각의 파일로 분리되었습니다.
# 기존 import 경로(from .model_handler import ...)를 유지하기 위해 여기서 재내보냅니다.
#
#   SubtitleModel  → subtitle_model.py
#   VibrationModel → vibration_model.py

from .subtitle_model import SubtitleModel
from .vibration_model import VibrationModel

__all__ = ["SubtitleModel", "VibrationModel"]
