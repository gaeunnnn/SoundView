import streamlit as st
import numpy as np
import pandas as pd
import soundfile as sf
import tensorflow as tf
import tensorflow_hub as hub
import tempfile
import subprocess
from pathlib import Path

st.set_page_config(page_title="Sound Caption Quick Test", layout="wide")
st.title("🎧 영상 속 소리 자막화 - 성능 테스트")

# ----------------------
# ffmpeg: video -> wav
# ----------------------
def extract_wav(video_path: str, wav_path: str, sr: int = 16000):
    cmd = [
        "ffmpeg", "-y",
        "-i", video_path,
        "-ac", "1",          # mono
        "-ar", str(sr),      # 16kHz
        "-vn",               # no video
        wav_path
    ]
    subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

# ----------------------
# YAMNet load (pretrained)
# ----------------------
@st.cache_resource
def load_yamnet():
    model = hub.load("https://tfhub.dev/google/yamnet/1")
    class_map_path = model.class_map_path().numpy().decode("utf-8")
    # CSV: index, mid, display_name
    lines = Path(class_map_path).read_text(encoding="utf-8").splitlines()[1:]
    class_names = [ln.split(",")[2] for ln in lines]
    return model, class_names

@tf.function
def yamnet_infer(model, waveform):
    scores, embeddings, spectrogram = model(waveform)
    return scores

def infer_per_second(model, class_names, waveform_16k: np.ndarray, sr=16000, sec=1.0, top_k=3):
    win = int(sr * sec)
    n = len(waveform_16k) // win
    results = []
    for i in range(n):
        chunk = waveform_16k[i*win:(i+1)*win].astype(np.float32)
        scores = yamnet_infer(model, tf.convert_to_tensor(chunk))
        mean_scores = tf.reduce_mean(scores, axis=0).numpy()  # 대표 점수
        top_idx = mean_scores.argsort()[::-1][:top_k]
        top = [(class_names[j], float(mean_scores[j])) for j in top_idx]
        results.append({"start": i, "end": i+1, "top": top})
    return results

def srt_time(t):
    h = t // 3600
    m = (t % 3600) // 60
    s = t % 60
    return f"{h:02d}:{m:02d}:{s:02d},000"

def build_events(per_sec, threshold=0.25, min_duration=2):
    # top1 기준으로 이벤트를 병합(자막 깜빡임 방지)
    labels = []
    for r in per_sec:
        label, score = r["top"][0]
        labels.append(label if score >= threshold else None)

    events = []
    cur_label = None
    cur_start = 0
    for i, lb in enumerate(labels + [None]):  # flush
        if lb != cur_label:
            if cur_label is not None:
                dur = i - cur_start
                if dur >= min_duration:
                    events.append((cur_start, i, cur_label))
            cur_label = lb
            cur_start = i
    return events

def to_srt(events):
    out = []
    for idx, (stt, edt, label) in enumerate(events, start=1):
        out.append(str(idx))
        out.append(f"{srt_time(stt)} --> {srt_time(edt)}")
        out.append(f"[{label}]")
        out.append("")
    return "\n".join(out)

# ----------------------
# UI
# ----------------------
uploaded = st.file_uploader("테스트할 영상 업로드 (mp4/mov/mkv/webm)",  type=["mp4", "mov", "mkv", "webm", "mp3", "wav"])

col1, col2, col3 = st.columns(3)
sec = col1.selectbox("분석 단위(초)", [1, 2], index=0)
top_k = col2.slider("초별 Top-K", 1, 5, 3)
threshold = col3.slider("자막 threshold", 0.0, 1.0, 0.25, 0.01)
min_duration = st.slider("최소 지속 시간(초)", 1, 5, 2)

if uploaded:
    with tempfile.TemporaryDirectory() as td:
        td = Path(td)
        video_path = td / uploaded.name
        video_path.write_bytes(uploaded.read())

        st.video(str(video_path))

        wav_path = td / "audio.wav"
        st.info("오디오 추출 중 (ffmpeg)...")
        extract_wav(str(video_path), str(wav_path), sr=16000)

        waveform, sr = sf.read(str(wav_path), dtype="float32")
        if sr != 16000:
            st.error(f"샘플레이트가 16kHz가 아닙니다: {sr}")
            st.stop()

        model, class_names = load_yamnet()

        st.info("소리 분류 중 (YAMNet pretrained)...")
        per_sec = infer_per_second(model, class_names, waveform, sr=sr, sec=float(sec), top_k=top_k)

        # table
        rows = []
        for r in per_sec:
            row = {"start": r["start"], "end": r["end"]}
            for i, (lb, sc) in enumerate(r["top"], start=1):
                row[f"top{i}_label"] = lb
                row[f"top{i}_score"] = round(sc, 3)
            rows.append(row)
        df = pd.DataFrame(rows)
        st.subheader("초별 Top-K 결과")
        st.dataframe(df, use_container_width=True)

        events = build_events(per_sec, threshold=threshold, min_duration=min_duration)
        srt = to_srt(events)

        st.subheader("SRT 미리보기")
        st.code(srt if srt.strip() else "(조건을 만족하는 이벤트가 없습니다)", language="srt")

        st.download_button("SRT 다운로드", data=srt.encode("utf-8"), file_name="sound_captions.srt", mime="text/plain")