# TCA9548A Cheat Sheet — I²C 8-Channel Multiplexer

> TI TCA9548A — Low-Voltage 8-Channel I²C Switch with Reset  
> I²C Address: **0x70** ~ **0x77** (A0, A1, A2 핀으로 설정)  
> 동작 전압: 1.65V ~ 5.5V

---

## 1. 개요

DRV2605L의 I²C 주소는 **0x5A 고정**이므로, 같은 버스에 여러 개를 연결할 수 없음.  
TCA9548A를 사이에 두면 8개의 독립 I²C 채널로 분리하여 각각 별도로 통신 가능.

```
ESP32 (Master)
  │
  ├─ SDA/SCL
  │
  ▼
TCA9548A (0x70)
  │
  ├── CH0: SD0/SC0 ──→ DRV2605L #0 (0x5A) ──→ LRA
  ├── CH1: SD1/SC1 ──→ DRV2605L #1 (0x5A) ──→ LRA
  ├── CH2: SD2/SC2 ──→ DRV2605L #2 (0x5A) ──→ LRA
  ├── CH3: SD3/SC3 ──→ DRV2605L #3 (0x5A) ──→ LRA
  ├── CH4: SD4/SC4 ──→ DRV2605L #4 (0x5A) ──→ LRA
  ├── CH5: SD5/SC5 ──→ DRV2605L #5 (0x5A) ──→ LRA
  ├── CH6: SD6/SC6 ──→ DRV2605L #6 (0x5A) ──→ LRA
  └── CH7: SD7/SC7 ──→ DRV2605L #7 (0x5A) ──→ LRA
```

---

## 2. 핵심 사양

| 항목 | 값 |
|---|---|
| I²C 주소 범위 | 0x70 ~ 0x77 (A0/A1/A2로 3비트 설정) |
| 채널 수 | 8개 (양방향 스위치) |
| 동작 전압 | 1.65V ~ 5.5V (5V 톨러런트) |
| 레지스터 | **단 1개** — Control Register (8비트) |
| I²C 속도 | 최대 400kHz |
| RESET | Active-LOW. 모든 채널 비활성화 (POR과 동일) |
| 전압 레벨 변환 | 마스터/슬레이브 측 전압이 달라도 동작 |

---

## 3. 주소 설정 (A0, A1, A2)

| A2 | A1 | A0 | 주소 |
|---|---|---|---|
| GND | GND | GND | **0x70** (기본) |
| GND | GND | VCC | 0x71 |
| GND | VCC | GND | 0x72 |
| GND | VCC | VCC | 0x73 |
| VCC | GND | GND | 0x74 |
| VCC | GND | VCC | 0x75 |
| VCC | VCC | GND | 0x76 |
| VCC | VCC | VCC | 0x77 |

> TCA9548A를 최대 8개 연결 시 → 64개 동일 주소 디바이스 제어 가능

---

## 4. Control Register (채널 선택)

```
비트:  [7]   [6]   [5]   [4]   [3]   [2]   [1]   [0]
채널:  CH7   CH6   CH5   CH4   CH3   CH2   CH1   CH0

1 = 해당 채널 활성 (연결)
0 = 해당 채널 비활성 (차단)
```

| 쓰기 값 | 활성 채널 | 설명 |
|---|---|---|
| `0x00` | 없음 | 모든 채널 차단 |
| `0x01` (1 << 0) | CH0 | 채널 0만 활성 |
| `0x02` (1 << 1) | CH1 | 채널 1만 활성 |
| `0x04` (1 << 2) | CH2 | 채널 2만 활성 |
| `0x08` (1 << 3) | CH3 | 채널 3만 활성 |
| `0x10` (1 << 4) | CH4 | 채널 4만 활성 |
| `0x20` (1 << 5) | CH5 | 채널 5만 활성 |
| `0x40` (1 << 6) | CH6 | 채널 6만 활성 |
| `0x80` (1 << 7) | CH7 | 채널 7만 활성 |
| `0x03` | CH0 + CH1 | 동시 활성 (같은 주소 디바이스면 충돌!) |

> ⚠️ **DRV2605L처럼 고정 주소 디바이스에서는 반드시 한 번에 하나의 채널만 활성화할 것**

---

## 5. ESP32 Arduino 코드

### 채널 선택 함수

```cpp
#include <Wire.h>

#define TCA9548A_ADDR 0x70

void tcaSelect(uint8_t channel) {
    if (channel > 7) return;
    Wire.beginTransmission(TCA9548A_ADDR);
    Wire.write(1 << channel);
    Wire.endTransmission();
}

void tcaDisableAll() {
    Wire.beginTransmission(TCA9548A_ADDR);
    Wire.write(0x00);
    Wire.endTransmission();
}
```

### 사용 예시

```cpp
// DRV2605L #3에 RTP 진폭 쓰기
tcaSelect(3);
writeRegDRV(0x02, 180);  // amplitude = 180

// DRV2605L #5의 Status 읽기
tcaSelect(5);
uint8_t status = readRegDRV(0x00);

// 모든 드라이버 초기화
for (uint8_t ch = 0; ch < 8; ch++) {
    tcaSelect(ch);
    // ... DRV2605L 초기화 코드 ...
}
```

### I²C 스캔 (디버깅용)

```cpp
void scanAllChannels() {
    for (uint8_t ch = 0; ch < 8; ch++) {
        tcaSelect(ch);
        Serial.printf("=== CH%d ===\n", ch);
        for (uint8_t addr = 1; addr < 127; addr++) {
            Wire.beginTransmission(addr);
            if (Wire.endTransmission() == 0) {
                Serial.printf("  Found: 0x%02X\n", addr);
            }
        }
    }
}
```

---

## 6. 배선

```
ESP32 Devkit v1        TCA9548A          DRV2605L (×8)
───────────────        ────────          ─────────────
3.3V ─────────────────→ VCC
GND  ─────────────────→ GND
                        A0 → GND
                        A1 → GND         (주소 = 0x70)
                        A2 → GND
GPIO21 (SDA) ─────────→ SDA              
GPIO22 (SCL) ─────────→ SCL              
GPIO (any) ───────────→ RESET (또는 VCC에 풀업)
                        │
                        SD0/SC0 ──────→ SDA/SCL of DRV #0
                        SD1/SC1 ──────→ SDA/SCL of DRV #1
                        ...
                        SD7/SC7 ──────→ SDA/SCL of DRV #7
```

### 풀업 저항

- **마스터 측 (ESP32 ↔ TCA9548A)**: 4.7kΩ → 3.3V (TCA9548A 모듈에 내장된 경우 생략)
- **각 채널 측 (TCA9548A ↔ DRV2605L)**: 4.7kΩ → 3.3V 필요 (DRV2605L 브레이크아웃 보드에 내장된 경우 생략)
- TCA9548A는 마스터 측에만 내장 풀업이 있고, 채널 측에는 없음

---

## 7. 주의사항

### 채널 전환 타이밍
- 채널이 실제로 활성화되는 시점은 **I²C Stop condition 이후**
- `Wire.endTransmission()` 호출 후 바로 다른 디바이스와 통신 가능

### RESET 핀 활용
- Active-LOW: LOW 펄스 → 모든 채널 비활성화 (= Control Register에 0x00 쓰기와 동일)
- I²C 하위 버스가 stuck 상태가 되었을 때 하드웨어 복구에 사용
- 미사용 시 VCC에 풀업

### DRV2605L 주소 충돌
- TCA9548A 주소 = **0x70**, DRV2605L 주소 = **0x5A** → 충돌 없음
- 만약 다른 디바이스가 0x70을 쓴다면 A0~A2 핀으로 TCA9548A 주소 변경

### 다중 MUX 확장
```
ESP32
  ├─ TCA9548A #0 (0x70) → DRV2605L ×8
  ├─ TCA9548A #1 (0x71) → DRV2605L ×8
  └─ ...최대 8개 MUX → 64개 DRV2605L
```

### 성능 고려
- 채널 전환 1회 = I²C 트랜잭션 1회 (주소+1바이트)
- 400kHz I²C에서 ~25µs 소요
- 8채널 순회 시 전환 오버헤드 ~200µs → 대부분의 햅틱 패턴에서 무시 가능

---

*참고: TI TCA9548A Datasheet (SCPS206), Adafruit TCA9548A Guide*
