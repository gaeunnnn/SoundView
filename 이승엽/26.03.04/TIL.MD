
## 연속 메모리 할당 (Continuous Memory Allocation)

운영체제가 프로세스를 메모리에 올릴 때 **중간에 끊기지 않는 연속된 공간**을 주는 방식.

### 1. 할당 방식

* **고정 크기 할당:** 메모리를 미리 똑같은 크기로 나눠두고 하나씩 할당. (내부 단편화 발생)
* **가변 크기 할당:** 프로세스 크기에 맞춰서 동적으로 할당. (외부 단편화 발생)

### 2. 단편화 (Fragmentation)

* **외부 단편화:** 빈 공간 총합은 충분한데, 조각조각 나 있어서 정작 큰 프로세스가 못 들어가는 상황.
* **내부 단편화:** 정해진 칸이 프로세스보다 커서 할당 후 남는 공간이 생기는 상황.

### 3. 배치 전략 (Placement)

* **최초 적합 (First Fit):** 빈 공간 찾다가 첫 번째로 나오는 공간에 바로 넣음. (속도 제일 빠름)
* **최적 적합 (Best Fit):** 빈 공간 다 뒤져서 프로세스랑 크기가 가장 비슷한 곳에 넣음. (자투리 최소화)
* **최악 적합 (Worst Fit):** 가장 큼직한 공간에 넣음. 자투리를 크게 남겨서 나중에 다른 프로세스가 쓰게 하려는 의도. (근데 결과는 안 좋음)

---

### 프로젝트 MVP기능 테스트코드 작성 (사용자 말->감정분석)

import os
import shutil
import subprocess
import sys
import torch  # 🔥 명시적으로 추가해서 NameError 방지
import whisper
import librosa
import numpy as np
import soundfile as sf
import uuid
from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from transformers import pipeline
import imageio_ffmpeg

# --- [윈도우 FFmpeg 환경 설정] ---
ffmpeg_path = imageio_ffmpeg.get_ffmpeg_exe()
if not os.path.exists("ffmpeg.exe"):
    shutil.copy(ffmpeg_path, "ffmpeg.exe")
os.environ["PATH"] = os.getcwd() + os.pathsep + os.environ.get("PATH", "")

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 서빙용 폴더 생성
os.makedirs("static", exist_ok=True)
app.mount("/static", StaticFiles(directory="static"), name="static")

print("🚀 DuckDuck AI 엔진 예열 중... (Whisper + 감정 분석)") #
# 안전하게 large-v2 사용
stt_model = whisper.load_model("large-v2") 
emotion_classifier = pipeline(
    "audio-classification", 
    model="jungjongho/wav2vec2-xlsr-korean-speech-emotion-recognition",
    device=-1
)
print("✅ 준비 완료! 이제 분석을 시작할 수 있어.")

@app.post("/api/analyze-segments")
async def analyze_segments(audioFile: UploadFile = File(...)):
    uid = str(uuid.uuid4())[:8]
    temp_in = f"temp_{uid}.wav"
    
    with open(temp_in, "wb") as f:
        shutil.copyfileobj(audioFile.file, f)

    try:
        # 1. STT 및 타임스탬프 추출
        print(f"[{uid}] 1. Whisper 분석 중...")
        stt_res = stt_model.transcribe(temp_in, language="ko")
        segments = stt_res["segments"]

        # 2. Demucs 음원 분리 (환경 변수 강제 주입)
        print(f"[{uid}] 2. Demucs 보컬 추출 중...")
        try:
            current_env = os.environ.copy()
            subprocess.run(
                [sys.executable, "-m", "demucs", "-n", "htdemucs", "--two-stems=vocals", temp_in],
                check=True, capture_output=True, text=True, env=current_env
            )
        except subprocess.CalledProcessError as e:
            err = e.stderr if e.stderr else e.stdout
            print(f"❌ Demucs 실패: {err}")
            return {"error": f"분리 실패: {err[:150]}"}
        
        vocal_path = os.path.join("separated", "htdemucs", f"temp_{uid}", "vocals.wav")
        served_path = f"static/vocals_{uid}.wav"
        shutil.copy(vocal_path, served_path)

        # 3. 보컬 기반 조각 분석
        y, sr = librosa.load(served_path, sr=None)
        final_results = []

        for i, seg in enumerate(segments):
            start, end, text = seg['start'], seg['end'], seg['text'].strip()
            if not text: continue

            y_seg = y[int(start*sr):int(end*sr)]
            if len(y_seg) < sr * 0.5: continue

            tmp_seg = f"seg_{uid}_{i}.wav"
            sf.write(tmp_seg, y_seg, sr)

            # 감정 및 물리적 특징
            emo = emotion_classifier(tmp_seg)
            rms = np.mean(librosa.feature.rms(y=y_seg))
            
            vol = "🔊 큰 소리" if rms > 0.08 else "🔉 작은 소리" if rms < 0.015 else "🔈 보통 소리"
            try:
                bpm = float(librosa.beat.tempo(y=y_seg, sr=sr)[0])
                spd = "🐇 빠른 말투" if bpm > 130 else "🐌 느린 말투" if bpm < 95 else "🚶 보통 속도"
            except:
                spd = "속도 측정 불가"

            final_results.append({
                "time": f"{start:.1f}s ~ {end:.1f}s",
                "text": text,
                "emotion": emo[0]['label'],
                "conf": round(emo[0]['score']*100, 1),
                "tags": [vol, spd]
            })
            os.remove(tmp_seg)

        return {
            "vocal_url": f"http://localhost:8000/{served_path}",
            "segments": final_results
        }

    except Exception as e:
        print(f"❌ 프로세스 에러: {str(e)}")
        return {"error": str(e)}
    finally:
        if os.path.exists(temp_in): os.remove(temp_in)
        if os.path.exists("separated"): shutil.rmtree("separated")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000)