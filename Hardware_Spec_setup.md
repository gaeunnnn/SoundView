# 프로젝트 하드웨어 Cheat Sheet — ESP32 + LRA + 시스템 구성

> 프로젝트: 청각장애인용 몰입형 오디오-햅틱 체험 시스템  
> 구성: ESP32 → TCA9548A → DRV2605L ×8 → LRA

---

## 1. 시스템 아키텍처

```
ESP32 Devkit v1
  │
  ├─ I²C (GPIO21=SDA, GPIO22=SCL, 400kHz)
  │
  ▼
TCA9548A (0x70)
  │
  ├── CH0~CH3 → DRV2605L → VG1040003D (170Hz LRA)   ← 저주파 담당
  └── CH4~CH7 → DRV2605L → VLV221007E (230Hz LRA)   ← 고주파 담당
```

> 채널-모터 매핑은 프로젝트 요구에 따라 변경 가능

---

## 2. ESP32 Devkit v1 핀 설정

| 기능 | GPIO | 비고 |
|---|---|---|
| I²C SDA | **GPIO21** | TCA9548A SDA로 연결 |
| I²C SCL | **GPIO22** | TCA9548A SCL로 연결 |
| MUX RESET | GPIO (any) | TCA9548A RESET (Active-LOW). 미사용 시 3.3V 풀업 |
| DRV EN | GPIO (any) | 전체 DRV2605L EN 핀 제어 (개별 또는 공통) |
| Serial (USB) | GPIO1(TX), GPIO3(RX) | 디버깅 / RTP 패턴 수신 |

### I²C 초기화

```cpp
#include <Wire.h>

void setup() {
    Wire.begin(21, 22);      // SDA=21, SCL=22
    Wire.setClock(400000);   // 400kHz Fast mode
}
```

---

## 3. LRA 모터 사양 비교

| 항목 | VG1040003D | VLV221007E |
|---|---|---|
| **공진주파수 f₀** | **170Hz** ±5Hz | **230Hz** |
| 주파수 범위 | 150 ~ 200 Hz | 210 ~ 250 Hz |
| **정격 전압** | **2.5 Vrms** AC | **2.3 Vrms** AC |
| 동작 전압 범위 | 0.1 ~ 2.5 Vrms | 0.1 ~ 2.35 Vrms |
| 정격 전류 | 200 mArms Max | 180 mArms Max |
| Rise Time (50%) | **10ms** Max | 50ms Max |
| Fall Time | 50ms Max (10%) | 50ms Max (50%) |
| 적합 용도 | 빠른 반응, 강한 충격 | 세밀한 텍스처, 부드러운 피드백 |

---

## 4. DRV2605L 레지스터 계산 (모터별)

### 4.1 VG1040003D (170Hz, 2.5Vrms)

```
DRIVE_TIME:
  반주기 = 1/(2×170) = 2.941ms
  DRIVE_TIME = (2.941 - 0.5) / 0.1 = 24.4 → 24 = 0x18
  검증: 0x18 × 0.1 + 0.5 = 2.9ms → f ≈ 172Hz ✓

RATED_VOLTAGE (LRA Closed-Loop 간략식):
  REG = 2.5 / 0.02071 = 120.7 → 121 = 0x79

OD_CLAMP (정격의 110%):
  V_OD = 2.5 × 1.1 = 2.75V
  REG = 2.75 / 0.02196 = 125.2 → 125 = 0x7D

OL_LRA_PERIOD:
  REG = 1/(170 × 98.46µs) = 59.7 → 60 = 0x3C
```

| 레지스터 | 주소 | 값 | 의미 |
|---|---|---|---|
| DRIVE_TIME | 0x1B [4:0] | **0x18** | 2.9ms → ~172Hz |
| RATED_VOLTAGE | 0x16 | **0x79** | 2.5 Vrms |
| OD_CLAMP | 0x17 | **0x7D** | 2.75V 클램프 |
| OL_LRA_PERIOD | 0x20 | **0x3C** | 170Hz 오픈루프 |

### 4.2 VLV221007E (230Hz, 2.3Vrms)

```
DRIVE_TIME:
  반주기 = 1/(2×230) = 2.174ms
  DRIVE_TIME = (2.174 - 0.5) / 0.1 = 16.7 → 17 = 0x11
  검증: 0x11 × 0.1 + 0.5 = 2.2ms → f ≈ 227Hz ✓

RATED_VOLTAGE:
  REG = 2.3 / 0.02071 = 111.1 → 111 = 0x6F

OD_CLAMP (spec max = 2.35V):
  REG = 2.35 / 0.02196 = 107.0 → 107 = 0x6B

OL_LRA_PERIOD:
  REG = 1/(230 × 98.46µs) = 44.1 → 44 = 0x2C
```

| 레지스터 | 주소 | 값 | 의미 |
|---|---|---|---|
| DRIVE_TIME | 0x1B [4:0] | **0x11** | 2.2ms → ~227Hz |
| RATED_VOLTAGE | 0x16 | **0x6F** | 2.3 Vrms |
| OD_CLAMP | 0x17 | **0x6B** | 2.35V 클램프 |
| OL_LRA_PERIOD | 0x20 | **0x2C** | 230Hz 오픈루프 |

### 4.3 공통 레지스터 (두 모터 모두)

| 레지스터 | 주소 | 값 | 의미 |
|---|---|---|---|
| Feedback Control | 0x1A | **0xB6** | N_ERM_LRA=1, BRAKE=3, LOOP_GAIN=1, BEMF_GAIN=2 |
| Control1 | 0x1B | **0x80 \| DT** | STARTUP_BOOST=1 + 모터별 DRIVE_TIME |
| Control2 | 0x1C | **0xF5** | BIDIR=1, BRAKE_STAB=1, SAMPLE=3, BLANK=1, IDISS=1 |
| Control3 | 0x1D | **0xA8** | NG_THRESH=2, DATA_FORMAT_RTP=1(unsigned), 나머지 0 |

> `0xA8` = unsigned RTP(0~255). signed(–128~+127)로 쓰려면 `0xA0`

---

## 5. 멀티 드라이버 초기화 코드

```cpp
#include <Wire.h>

#define TCA_ADDR  0x70
#define DRV_ADDR  0x5A
#define NUM_CH    8

// 채널별 모터 타입 정의 (프로젝트에 맞게 수정)
enum MotorType { VG1040003D, VLV221007E };

MotorType motorMap[NUM_CH] = {
    VG1040003D, VG1040003D, VG1040003D, VG1040003D,  // CH0~3
    VLV221007E, VLV221007E, VLV221007E, VLV221007E   // CH4~7
};

void tcaSelect(uint8_t ch) {
    Wire.beginTransmission(TCA_ADDR);
    Wire.write(1 << ch);
    Wire.endTransmission();
}

void drvWrite(uint8_t reg, uint8_t val) {
    Wire.beginTransmission(DRV_ADDR);
    Wire.write(reg);
    Wire.write(val);
    Wire.endTransmission();
}

uint8_t drvRead(uint8_t reg) {
    Wire.beginTransmission(DRV_ADDR);
    Wire.write(reg);
    Wire.endTransmission(false);
    Wire.requestFrom(DRV_ADDR, (uint8_t)1);
    return Wire.read();
}

void initAllDrivers() {
    for (uint8_t ch = 0; ch < NUM_CH; ch++) {
        tcaSelect(ch);
        
        // 모터별 파라미터
        uint8_t driveTime, ratedV, odClamp;
        if (motorMap[ch] == VG1040003D) {
            driveTime = 0x18;  // 170Hz
            ratedV    = 0x79;  // 2.5Vrms
            odClamp   = 0x7D;  // 2.75V
        } else {
            driveTime = 0x11;  // 230Hz
            ratedV    = 0x6F;  // 2.3Vrms
            odClamp   = 0x6B;  // 2.35V
        }
        
        // Auto Calibration 모드 진입
        drvWrite(0x01, 0x07);              // MODE = Auto Cal
        drvWrite(0x16, ratedV);            // Rated Voltage
        drvWrite(0x17, odClamp);           // OD Clamp
        drvWrite(0x1A, 0xB6);             // LRA, feedback settings
        drvWrite(0x1B, 0x80 | driveTime); // STARTUP_BOOST + DRIVE_TIME
        drvWrite(0x1C, 0xF5);             // Control2
        drvWrite(0x1D, 0xA8);             // Control3 (unsigned RTP)
        drvWrite(0x0C, 0x01);             // GO → Calibration 시작
    }
    
    delay(1500);  // 캘리브레이션 완료 대기
    
    // 결과 확인 + RTP 모드 전환
    for (uint8_t ch = 0; ch < NUM_CH; ch++) {
        tcaSelect(ch);
        uint8_t status = drvRead(0x00);
        if (status & 0x08) {
            Serial.printf("[CH%d] Calibration FAILED! Status=0x%02X\n", ch, status);
        } else {
            Serial.printf("[CH%d] Calibration OK\n", ch);
        }
        drvWrite(0x01, 0x05);  // RTP 모드 전환
    }
}

void setAmplitude(uint8_t ch, uint8_t amp) {
    tcaSelect(ch);
    drvWrite(0x02, amp);  // 0=정지, 255=최대
}

void stopAll() {
    for (uint8_t ch = 0; ch < NUM_CH; ch++) {
        tcaSelect(ch);
        drvWrite(0x02, 0x00);
    }
}

void setup() {
    Serial.begin(115200);
    Wire.begin(21, 22);
    Wire.setClock(400000);
    delay(300);  // DRV2605L 파워온 대기
    
    initAllDrivers();
    Serial.println("All drivers initialized.");
}

void loop() {
    // 예: 전체 채널에 순차적으로 진동
    for (uint8_t ch = 0; ch < NUM_CH; ch++) {
        setAmplitude(ch, 200);
        delay(100);
        setAmplitude(ch, 0);
        delay(50);
    }
    delay(1000);
}
```

---

## 6. 전원 설계 참고

| 항목 | 값 | 비고 |
|---|---|---|
| DRV2605L VDD | 2.0 ~ 5.2V | ESP32 3.3V 직결 가능. 5V 사용 시 더 강한 구동 |
| DRV2605L 최대 출력 전압 | ≤ VDD | OD_CLAMP가 VDD보다 높으면 VDD로 클램핑됨 |
| VG1040003D 정격 전류 | 200mA rms | 8개 동시 구동 시 최대 ~1.6A |
| VLV221007E 정격 전류 | 180mA rms | 8개 동시 구동 시 최대 ~1.44A |
| ESP32 3.3V 레귤레이터 | 최대 ~500mA | DRV2605L에는 별도 전원 권장 |

> ⚠️ **8개 LRA를 동시에 전력 구동하면 전류가 크므로**, DRV2605L VDD는 USB 5V 또는 외부 전원에서 직접 공급하고, ESP32의 3.3V 레귤레이터에 의존하지 말 것.

### 권장 전원 구성

```
USB 5V 또는 외부 5V
  │
  ├──→ ESP32 VIN (5V)
  │
  └──→ DRV2605L VDD (×8)  ← 각 모듈에 1µF 바이패스 캡
       └──→ TCA9548A VCC
```

---

## 7. I²C 버스 주소 맵

| 주소 | 디바이스 | 비고 |
|---|---|---|
| **0x70** | TCA9548A | 멀티플렉서 (마스터 버스에 항상 보임) |
| **0x5A** | DRV2605L | 채널 선택 후에만 보임 (8개 중 하나) |

> `i2cdetect` 실행 시 0x70만 보이는 게 정상. 0x5A는 `tcaSelect()` 후에 보임.

---

*참고: ESP32 Devkit v1 핀맵, TI DRV2605L Datasheet (SLOS854D), TI TCA9548A Datasheet*
