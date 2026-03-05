import librosa
import numpy as np
import json
import soundfile as sf # 오디오 저장용 라이브러리 추가
import os

def generate_vibration_json_and_audio(audio_path, output_json_path, output_audio_path, interval=0.1):
    print(f"--- [분석 시작] {audio_path} ---")

    # 1. 오디오 로드 (Sample Rate 유지)
    try:
        y, sr = librosa.load(audio_path, sr=None)
    except Exception as e:
        print(f"오류: 파일을 불러올 수 없습니다. {e}")
        return

    # ---------------------------------------------------------
    # [전처리 1단계] 저음역대 필터링 (Low Pass Filter 효과)
    # ---------------------------------------------------------
    # 진동은 '쿵' 하는 저음(0~500Hz)에서 가장 잘 느껴지므로, 고음역대(바람소리 등)를 제거합니다.
    # 버터워스 필터(Butterworth Filter)를 사용하여 부드럽게 깎아냅니다.
    from scipy.signal import butter, lfilter

    def butter_lowpass(cutoff, fs, order=5):
        nyq = 0.5 * fs
        normal_cutoff = cutoff / nyq
        b, a = butter(order, normal_cutoff, btype='low', analog=False)
        return b, a

    def lowpass_filter(data, cutoff, fs, order=5):
        b, a = butter_lowpass(cutoff, fs, order=order)
        y = lfilter(b, a, data)
        return y

    # 500Hz 이하만 통과시킴
    y_filtered = lowpass_filter(y, cutoff=500, fs=sr, order=6)

    # ---------------------------------------------------------
    # [전처리 2단계] 노이즈 게이트 & 양자화 (Vibration Logic)
    # ---------------------------------------------------------
    # 진동 데이터 생성을 위한 RMS 에너지 계산
    hop_length = int(sr * interval) # 0.1초 간격
    
    # 필터링된 오디오의 에너지(RMS) 계산
    rms = librosa.feature.rms(y=y_filtered, frame_length=2048, hop_length=hop_length)[0]

    # 에너지 정규화 (0.0 ~ 1.0)
    if np.max(rms) > 0:
        norm_rms = (rms - np.min(rms)) / (np.max(rms) - np.min(rms))
    else:
        norm_rms = rms

    vibration_timeline = []
    
    # 미리듣기용 오디오를 만들기 위한 마스크(Mask) 배열
    # (진동이 0인 구간은 소리도 0으로 만들기 위함)
    audio_mask = np.zeros_like(rms)

    NOISE_THRESHOLD = 0.15  # 15% 이하 소리 무시
    
    for i, amp in enumerate(norm_rms):
        pwm_value = 0

        # (A) 노이즈 게이트: 임계값 이하는 0
        if amp <= NOISE_THRESHOLD:
            pwm_value = 0
            audio_mask[i] = 0 # 소리도 끔 (Mute)
        
        # (B) 양자화 & 진동 생성
        else:
            audio_mask[i] = 1 # 소리 킴
            
            if amp < 0.4:
                pwm_value = 80   # 약한 진동
            elif amp < 0.7:
                pwm_value = 150  # 중간 진동
            else:
                pwm_value = 255  # 강한 진동 (Max)

        vibration_timeline.append(int(pwm_value))

    # ---------------------------------------------------------
    # [미리듣기 생성] 필터링된 오디오에 노이즈 게이트 적용하여 저장
    # ---------------------------------------------------------
    # RMS 단위(0.1초)로 된 마스크를 원래 오디오 샘플 단위로 늘려줍니다.
    # 예: [0, 1, 1, 0] -> [00000, 11111, 11111, 00000]
    expanded_mask = np.repeat(audio_mask, hop_length)
    
    # 길이 맞추기 (오디오 길이와 마스크 길이가 약간 다를 수 있음)
    min_len = min(len(y_filtered), len(expanded_mask))
    y_preview = y_filtered[:min_len] * expanded_mask[:min_len]

    # 오디오 파일 저장 (.wav)
    sf.write(output_audio_path, y_preview, sr)
    print(f"--- [완료] 미리듣기 오디오 저장됨: {output_audio_path} ---")


    # ---------------------------------------------------------
    # [JSON 저장]
    # ---------------------------------------------------------
    output_data = {
        "metadata": {
            "filename": os.path.basename(audio_path),
            "interval_sec": interval,
            "total_duration": round(len(vibration_timeline) * interval, 2)
        },
        "timeline": vibration_timeline
    }

    with open(output_json_path, 'w', encoding='utf-8') as f:
        json.dump(output_data, f, indent=4)

    print(f"--- [완료] JSON 데이터 저장됨: {output_json_path} ---")


# --- 실행 ---
if __name__ == "__main__":
    # 입력 파일 (배경음)
    input_wav = "shoppingmall_(Instrumental)_UVR-MDX-NET-Inst_HQ_3.wav" 
    
    # 출력 파일들
    output_json = "vibration_data.json"
    output_audio = "processed_preview.wav"

    if os.path.exists(input_wav):
        generate_vibration_json_and_audio(input_wav, output_json, output_audio, interval=0.1)
    else:
        print(f"오류: '{input_wav}' 파일이 없습니다.")