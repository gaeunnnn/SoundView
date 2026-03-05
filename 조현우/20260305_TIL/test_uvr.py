import os
from audio_separator.separator import Separator

# 1. 분리기 초기화
print("모델을 준비 중입니다...")
separator = Separator()

# 2. 모델 로드
# UVR-MDX-NET-Inst_HQ_3.onnx 모델 로드
separator.load_model(model_filename='UVR-MDX-NET-Inst_HQ_3.onnx')

# 3. 폴더 내 모든 파일 처리
input_dir = './input_audio'
output_dir = './output_audio'

if not os.path.exists(output_dir):
    os.makedirs(output_dir)

# 처리 가능한 확장자
extensions = ('.mp3', '.wav', '.flac', '.m4a')

audio_files = [f for f in os.listdir(input_dir) if f.lower().endswith(extensions)]

if not audio_files:
    print(f"'{input_dir}' 폴더에 처리할 음성 파일이 없습니다.")
else:
    print(f"총 {len(audio_files)}개의 파일을 찾았습니다. 변환을 시작합니다...")
    
    for filename in audio_files:
        input_path = os.path.join(input_dir, filename)
        print(f"\n--- 처리 중: {filename} ---")
        
        # 분리 실행 (결과물은 기본적으로 현재 실행 위치에 생성되거나 output_dir 지정 가능)
        # separator.separate는 생성된 파일 리스트를 반환합니다.
        output_files = separator.separate(input_path)
        print(f"완료: {output_files}")

print("\n모든 작업이 완료되었습니다!")