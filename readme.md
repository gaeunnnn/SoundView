# Haptic Vibration System

오디오 → 진동 패턴 변환 + ESP32 전송 파이프라인 레퍼런스

---

## 목차

1. [파일 구성](#파일-구성)
2. [VIB1 바이너리 포맷](#vib1-바이너리-포맷)
3. [오디오 처리 파이프라인](#오디오-처리-파이프라인)
4. [ESP32 펌웨어 프로토콜](#esp32-펌웨어-프로토콜)
5. [AI 음성 분리 연동](#ai-음성-분리-연동)
6. [프론트엔드 싱크 재생](#프론트엔드-싱크-재생)
7. [하드웨어 연결](#하드웨어-연결)

---

## 파일 구성

```
haptic-system/
├── audio_to_esp32.py        # 오디오 변환 + ESP32 전송 통합 스크립트
├── esp32_haptic_receiver/
│   └── esp32_haptic_receiver.ino   # ESP32 펌웨어 (VIB1 수신 + 진동 출력)
└── README.md
```

---

## VIB1 바이너리 포맷

모든 `.bin` 파일은 이 포맷을 따른다.

### 구조

```
┌─────────────────────────────────────┐
│            HEADER (12 bytes)        │
├────────┬───────┬───────┬────────────┤
│ magic  │  ver  │  fps  │  n_frames  │  ch  │
│ 4 byte │ 1 byte│2 byte │  4 bytes   │1 byte│
│ "VIB1" │  0x01 │uint16 │  uint32    │ 0x01 │
│        │       │  LE   │    LE      │      │
├────────┴───────┴───────┴────────────┴──────┤
│           PAYLOAD (n_frames bytes)         │
│   intensity[0], intensity[1], ... uint8    │
└────────────────────────────────────────────┘
```

### 필드 상세

| 오프셋 | 크기 | 타입 | 설명 |
|--------|------|------|------|
| 0 | 4 | char[4] | 매직 `VIB1` |
| 4 | 1 | uint8 | 버전 `0x01` |
| 5 | 2 | uint16 LE | 프레임 레이트 (Hz) |
| 7 | 4 | uint32 LE | 총 프레임 수 |
| 11 | 1 | uint8 | 채널 수 (현재 `0x01`) |
| 12~ | n_frames | uint8[] | 진동 강도 배열 (0~255) |

### 파싱 예시

```python
import struct

with open("alarm.bin", "rb") as f:
    data = f.read()

magic, ver, fps, n_frames, channels = struct.unpack_from("<4sBHIB", data, 0)
intensity = list(data[12:12 + n_frames])
```

```javascript
// JavaScript (프론트엔드)
const buf = await file.arrayBuffer();
const view = new DataView(buf);

const magic     = String.fromCharCode(...new Uint8Array(buf, 0, 4));  // "VIB1"
const fps       = view.getUint16(5, true);   // little-endian
const n_frames  = view.getUint32(7, true);
const intensity = new Uint8Array(buf, 12, n_frames);
```

---

## 오디오 처리 파이프라인

```
MP3 / WAV
    │
    ▼
librosa.load() ──► mono, 원본 sr 유지
    │
    ▼
RMS 추출 (hop_length = sr / fps)
    │
    ▼
amplitude_to_db(ref=np.max)   ← 최대값 기준 상대 dB
    │
    ▼
clip(-60dB ~ 0dB)
    │
    ▼
normalize → 0.0 ~ 1.0
    │
    ▼
tanh soft-clipping (scale=2.5)   ← 약한 소리 강조 / 강한 소리 압축
    │
    ▼
onset detect → ×1.4 boost
    │
    ▼
uniform_filter1d(size=3)         ← 급격한 변화 완화
    │
    ▼
×255 → uint8                     ← 무음 구간 강제 0
    │
    ▼
VIB1 bin 저장
```

### dB → intensity 매핑 (TANH_SCALE=2.5 기준)

| dB | intensity (대략) |
|----|----------------|
| -60 | 0 |
| -40 | 40 |
| -20 | 140 |
| -10 | 195 |
| 0 | 255 |

### 파라미터 튜닝

| 파라미터 | 기본값 | 효과 |
|----------|--------|------|
| `TANH_SCALE` | 2.5 | 높을수록 강약 대비 커짐 (3.0~4.0 추천) |
| `onset boost` | ×1.4 | 타격감 조절 |
| `smoothing size` | 3 | 클수록 부드러운 진동 |
| `fps` | 50 | 높을수록 세밀한 패턴 (ESP32 처리 한계 고려) |

---

## ESP32 펌웨어 프로토콜

### 수신 상태 머신

```
WAIT_HEADER ──► (12바이트 수신 완료 + VIB1 검증)
    │
    ▼
PLAY ──► (intensity 바이트 버퍼에 누적)
    │         │
    │         ▼
    │    타이머 (millis 기반, 1000/fps ms 간격)
    │         │
    │         ▼
    │    vib_buf[play_pos++] → DRV2605L REG_RTP
    │
    ▼
재생 완료 → RTP=0 → WAIT_HEADER (리셋)
```

### 시리얼 설정

| 항목 | 값 |
|------|-----|
| Baudrate | 921600 |
| 데이터 비트 | 8 |
| 패리티 | None |
| 스톱 비트 | 1 |

### DRV2605L 레지스터 설정 (LRA 오픈루프 RTP 모드)

| 레지스터 | 값 | 설명 |
|----------|-----|------|
| `0x01` MODE | `0x05` | RTP 모드 |
| `0x03` LIB | `0x06` | LRA 라이브러리 |
| `0x1A` FB_CON | `0xB6` | LRA 피드백, 브레이크 ON |
| `0x16` RATED_V | `0x3C` | 정격전압 1.8V |
| `0x17` OD_CLAMP | `0x89` | 최대전압 2.4V |
| `0x1B` CTRL1 | `0x93` | STARTUP_BOOST + DriveTime(170Hz) |
| `0x1D` CTRL3 | `+0x01` | LRA 오픈루프 활성화 |
| `0x02` RTP | `0x00~0xFF` | 진동 강도 (실시간 쓰기) |

---

## AI 음성 분리 연동

Demucs v4 등으로 vocal / non-vocal 분리 후 각각 변환하는 파이프라인.

### 권장 구조

```python
# 1. 음성 분리 (Demucs 예시)
import torchaudio
from demucs.pretrained import get_model
from demucs.apply import apply_model

model = get_model("htdemucs")
# stems: vocals, drums, bass, other

# 2. 각 stem → 별도 bin 생성
for stem_name, stem_audio in stems.items():
    save_wav(stem_audio, f"{stem_name}.wav")
    os.system(f"python audio_to_esp32.py {stem_name}.wav --out {stem_name}.bin")

# 3. 채널 믹싱 (stem별 가중치 조절)
WEIGHTS = {
    "vocals": 1.0,
    "drums":  0.8,
    "bass":   0.6,
    "other":  0.3,
}
```

### 멀티채널 확장 시 VIB1 포맷 수정

복수 모터 대응 시 `channels` 필드와 payload 구조 변경:

```
channels = 2 인 경우 payload:
  [frame0_L, frame0_R, frame1_L, frame1_R, ...]
  총 크기 = n_frames × channels bytes
```

```python
# 파싱
intensity = np.frombuffer(data[12:], dtype=np.uint8).reshape(n_frames, channels)
left  = intensity[:, 0]
right = intensity[:, 1]
```

---

## 프론트엔드 싱크 재생

오디오 재생과 진동 패턴을 프레임 단위로 동기화하는 방법.

### 기본 싱크 구조 (Web Audio API + WebSerial)

```javascript
class HapticPlayer {
  constructor(audioContext) {
    this.ctx        = audioContext;
    this.intensity  = null;  // Uint8Array
    this.fps        = 50;
    this.frameMs    = 1000 / this.fps;
    this.startTime  = null;
    this.rafId      = null;
  }

  // bin 파일 로드
  async loadBin(url) {
    const buf      = await fetch(url).then(r => r.arrayBuffer());
    const view     = new DataView(buf);
    this.fps       = view.getUint16(5, true);
    this.frameMs   = 1000 / this.fps;
    const n_frames = view.getUint32(7, true);
    this.intensity = new Uint8Array(buf, 12, n_frames);
  }

  // 재생 시작 (오디오 startTime과 동기화)
  start(audioStartTime) {
    this.startTime = audioStartTime;
    this._tick();
  }

  _tick() {
    const elapsed  = (this.ctx.currentTime - this.startTime) * 1000;  // ms
    const frameIdx = Math.floor(elapsed / this.frameMs);

    if (frameIdx < this.intensity.length) {
      const val = this.intensity[frameIdx];
      this._sendToESP32(val);       // WebSerial로 전송
      this.rafId = requestAnimationFrame(() => this._tick());
    } else {
      this._sendToESP32(0);         // 정지
    }
  }

  stop() {
    cancelAnimationFrame(this.rafId);
    this._sendToESP32(0);
  }

  // WebSerial 단일 바이트 전송
  async _sendToESP32(intensity) {
    if (!this.writer) return;
    await this.writer.write(new Uint8Array([intensity]));
  }
}
```

### 사용 예시

```javascript
const ctx    = new AudioContext();
const player = new HapticPlayer(ctx);

await player.loadBin("alarm.bin");

// 오디오 소스 생성
const source = ctx.createBufferSource();
source.buffer = await loadAudioBuffer("alarm.mp3");
source.connect(ctx.destination);

// 동시 시작 (싱크)
const startAt = ctx.currentTime + 0.1;
source.start(startAt);
player.start(startAt);
```

### 싱크 드리프트 보정

requestAnimationFrame은 정확히 fps에 맞지 않으므로 Web Audio API 시간 기준으로 프레임을 계산한다 (`ctx.currentTime` 사용). 타이머 기반(`setInterval`) 사용 금지.

```javascript
// ❌ 드리프트 발생
setInterval(() => sendFrame(frameIdx++), 20);

// ✅ 항상 currentTime 기준으로 프레임 인덱스 계산
const frameIdx = Math.floor((ctx.currentTime - startTime) * fps);
```

### WebSerial 연결

```javascript
// 포트 연결
const port = await navigator.serial.requestPort();
await port.open({ baudRate: 921600 });
const writer = port.writable.getWriter();

player.writer = writer;
```

> **주의:** WebSerial은 Chrome/Edge 전용 (Firefox 미지원). HTTPS 또는 localhost 환경 필요.

---

## 하드웨어 연결

### DRV2605L 1개 (현재 테스트 구성)

```
ESP32 DevKit v1          DRV2605L
─────────────────────────────────
GPIO21 (SDA)    ──────►  SDA
GPIO22 (SCL)    ──────►  SCL
3.3V            ──────►  VCC
GND             ──────►  GND
GND             ──────►  ADDR  (I2C 주소 0x5A)

DRV2605L          LRA 모터 (VG1040003D)
─────────────────────────────────
OUT+            ──────►  +
OUT-            ──────►  -
```

### DRV2605L 2개 확장 시

| 핀 | LEFT (0x5A) | RIGHT (0x5B) |
|----|------------|--------------|
| ADDR | GND | 3.3V |
| 모터 | VG1040003D (170Hz) | VLV221007E (230Hz) |
| SDA/SCL | 공유 (병렬 연결) | 공유 (병렬 연결) |

### TCA9548A 멀티플렉서 사용 시 (8채널 확장)

동일 I2C 주소 DRV2605L 다수 연결 시 TCA9548A (0x70) 경유.  
채널 선택: `Wire.write(1 << ch)` → 해당 채널 DRV만 활성화.



esp 5v - vin으로 변경
진동 패턴 테스트 하드웨어 제작해야함
rtp 패턴 에디터로 테스트 결과 간격 짧으면 잘 안느껴짐
dB - 모터 주파수 - 사람 청각 - 촉각에 맞춰서 잘 캘리브레이션 진행해야함
bin으로 esp 보내야 됨 JSON 많이 느림



