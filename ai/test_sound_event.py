"""
SoundEventModel(ATST-F) 단독 테스트 스크립트.

사용법:
    python test_sound_event.py <영상 또는 음성 파일 경로>

예시:
    python test_sound_event.py "C:\path\to\video.mp4"
    python test_sound_event.py "C:\path\to\audio.wav"
"""

import asyncio
import sys
import os
import json
import numpy as np
from datetime import datetime
from pathlib import Path

sys.path.append(os.getcwd())

from app.services.audio_service import AudioService
from app.services.ai.common.voice_separator import VoiceSeparator
from app.services.ai.tasks.atst.sound_event_model import SoundEventModel


async def test_sound_event():
    # 1. 입력 파일 확인
    if len(sys.argv) < 2:
        print("사용법: python test_sound_event.py <영상/음성 파일 경로>")
        print("예시:   python test_sound_event.py C:\\path\\to\\video.mp4")
        sys.exit(1)

    target_path = sys.argv[1]
    if not Path(target_path).exists():
        print(f"파일을 찾을 수 없습니다: {target_path}")
        sys.exit(1)

    print(f"{'='*60}")
    print(f" ATST-F SoundEventModel 단독 테스트")
    print(f"{'='*60}")
    print(f"입력 파일: {target_path}")

    # 2. 오디오 추출
    print("\n[1/4] 오디오 추출 중...")
    audio_service = AudioService()
    audio_array = await audio_service.extract_audio(target_path)
    duration_sec = len(audio_array) / audio_service.SAMPLE_RATE
    print(f"  ✅ 추출 완료: {duration_sec:.1f}초 ({len(audio_array):,} samples)")

    # 3. Demucs 배경음 분리
    print("\n[2/4] Demucs 배경음 분리 중...")
    voice_sep = VoiceSeparator()
    tracks = await voice_sep.separate(audio_array)
    no_vocals = tracks["no_vocals"]
    print(f"  ✅ 분리 완료: no_vocals {len(no_vocals):,} samples")

    # 4. SoundEventModel 추론
    print("\n[3/4] ATST-F 환경음 분류 추론 중...")
    sound_event_model = SoundEventModel()
    sound_result = await sound_event_model.predict(no_vocals)
    print(f"  ✅ 탐지 완료: {len(sound_result)}개 이벤트")

    # 5. 결과 출력
    print(f"\n{'='*60}")
    print(f" 결과: {len(sound_result)}개 환경음 이벤트")
    print(f"{'='*60}")

    if not sound_result:
        print("  (탐지된 환경음 이벤트가 없습니다)")
    else:
        for i, event in enumerate(sound_result, 1):
            start = event["start"]
            end = event["end"]
            caption = event["event"]
            conf = event.get("max_confidence", 0)
            print(f"  {i:2d}. [{start:6.2f}s ~ {end:6.2f}s] {caption}  (confidence: {conf:.3f})")

    # 6. JSON 저장
    print(f"\n{'='*60}")
    results_dir = Path("results")
    results_dir.mkdir(exist_ok=True)
    stem = Path(target_path).stem
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    json_path = results_dir / f"{stem}_sound_event_{timestamp}.json"

    output_data = {
        "meta": {
            "source_file": Path(target_path).name,
            "analyzed_at": datetime.now().isoformat(),
            "duration_sec": round(duration_sec, 2),
            "event_count": len(sound_result),
        },
        "sound_events": sound_result,
    }
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(output_data, f, ensure_ascii=False, indent=2)

    print(f"  ✅ JSON 저장: {json_path}")
    print(f"\n{'='*60}")
    print(json.dumps(sound_result, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    asyncio.run(test_sound_event())
