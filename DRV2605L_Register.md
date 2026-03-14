# DRV2605L Cheat Sheet — 동작 모드 & 레지스터 맵

> TI DRV2605L — 2 to 5.2V Haptic Driver for LRA/ERM  
> I²C Address: **0x5A** (7-bit)  
> Datasheet: SLOS854D (Rev.D, March 2018)

---

## 1. 디바이스 상태 흐름

```
         EN=0              EN=1, STANDBY=0
Shutdown ────→ Standby ────────────────→ Active
    ↑              ↑                        │
    │              └── STANDBY=1 ───────────┘
    └──────── DEV_RESET=1 ──────────────────┘
```

- **Shutdown**: EN 핀 LOW. I²C ACK는 하지만 읽기/쓰기 불가. 소비전류 ~4µA
- **Standby**: EN=HIGH, STANDBY=1 (기본값). 레지스터 유지, I²C 통신 가능. ~4µA
- **Active**: STANDBY=0. 파형 재생/캘리브레이션/진단 수행 가능. ~0.5mA (idle)

---

## 2. 동작 모드 (MODE 레지스터 0x01)

### MODE[2:0] 비트 (bit 2:0)

| 값 | 모드 | 설명 |
|---|---|---|
| `0` (0x00) | **Internal Trigger** | I²C로 GO 비트(0x0C) 세팅하여 ROM 파형 재생 |
| `1` (0x01) | **External Trigger (Edge)** | IN/TRIG 핀의 rising edge로 GO. 재 트리거 시 취소 |
| `2` (0x02) | **External Trigger (Level)** | IN/TRIG HIGH=GO, LOW=취소. 핀 유지해야 전체 재생 |
| `3` (0x03) | **PWM/Analog Input** | IN/TRIG 핀으로 PWM 또는 아날로그 입력. N_PWM_ANALOG(0x1D) 비트로 선택 |
| `4` (0x04) | **Audio-to-Vibe** | 오디오 입력을 햅틱으로 변환. AC_COUPLE, N_PWM_ANALOG 비트 = 1 |
| `5` (0x05) | **RTP (Real-Time Playback)** | 레지스터 0x02에 8비트 진폭 값 직접 기록 → 즉시 출력 |
| `6` (0x06) | **Diagnostics** | 액추에이터 개방/단락 진단. GO 세팅 후 결과는 0x00의 DIAG_RESULT |
| `7` (0x07) | **Auto Calibration** | 자동 레벨 캘리브레이션. GO 세팅 후 자동 완료 |

### MODE 레지스터 기타 비트

| 비트 | 이름 | 설명 |
|---|---|---|
| 7 | DEV_RESET | 1 쓰면 파워사이클과 동일한 리셋. 완료 후 자동 클리어 |
| 6 | STANDBY | 1=저전력 대기(기본값). 0=활성. 모드 전환 시 같이 0으로 내려야 함 |
| 2:0 | MODE[2:0] | 위 표 참조 |

> **Tip**: 초기화 시 `0x01` 레지스터에 한 번에 STANDBY=0 + 원하는 MODE를 동시에 쓸 수 있음  
> 예: RTP 모드 → `write(0x01, 0x05)`

---

## 3. 전체 레지스터 맵

### 3.1 상태/제어 (0x00–0x0C)

| Addr | 이름 | R/W | 기본값 | 설명 |
|---|---|---|---|---|
| 0x00 | **Status** | R | 0xE0 | [7:5] DEVICE_ID (DRV2605L=7), [3] DIAG_RESULT, [1] OVER_TEMP, [0] OC_DETECT |
| 0x01 | **Mode** | RW | 0x40 | [7] DEV_RESET, [6] STANDBY, [2:0] MODE |
| 0x02 | **RTP Input** | RW | 0x00 | RTP 모드 진폭 값 (signed/unsigned 선택 가능) |
| 0x03 | **Library Selection** | RW | 0x01 | [2:0] LIBRARY_SEL: 1~5=ERM Lib A~E, 6=LRA, 7=ERM Lib F, 0=Empty |
| 0x04–0x0B | **Waveform Seq 1–8** | RW | 0x00 | [7] Wait 플래그(1=딜레이), [6:0] 이펙트 ID (1~123) 또는 딜레이 ×10ms |
| 0x0C | **GO** | RW | 0x00 | [0] GO 비트. 1=재생/캘리/진단 시작. 완료 시 자동 클리어 |

### 3.2 시간 오프셋 (0x0D–0x10) — ROM 파형 파라미터화

| Addr | 이름 | 설명 |
|---|---|---|
| 0x0D | Overdrive Time Offset | 오버드라이브 구간 시간 보정 (signed, ms) |
| 0x0E | Sustain Time Offset (+) | 양방향 sustain 시간 보정 |
| 0x0F | Sustain Time Offset (–) | 음방향 sustain 시간 보정 |
| 0x10 | Brake Time Offset | 브레이크 구간 시간 보정 |

### 3.3 Audio-to-Vibe (0x11–0x15)

| Addr | 이름 | 설명 |
|---|---|---|
| 0x11 | Audio-to-Vibe Control | [2:0] ATH_PEAK_TIME, [3:2] ATH_FILTER |
| 0x12 | Audio-to-Vibe Min Input | 최소 입력 레벨 (기본 0x19) |
| 0x13 | Audio-to-Vibe Max Input | 최대 입력 레벨 (기본 0xFF) |
| 0x14 | Audio-to-Vibe Min Output | 최소 출력 드라이브 (기본 0x19) |
| 0x15 | Audio-to-Vibe Max Output | 최대 출력 드라이브 (기본 0xFF) |

### 3.4 액추에이터 설정/캘리브레이션 (0x16–0x1A)

| Addr | 이름 | 설명 |
|---|---|---|
| 0x16 | **Rated Voltage** | 액추에이터 정격 전압. 캘리브레이션의 100% 기준. **OTP 가능** |
| 0x17 | **Overdrive Clamp** | 오버드라이브 최대 전압 클램프. **OTP 가능** |
| 0x18 | **A_CAL_COMP** | 자동 캘리브레이션 보상 계수 (캘리 결과). **OTP 가능** |
| 0x19 | **A_CAL_BEMF** | 자동 캘리브레이션 Back-EMF 계수 (캘리 결과). **OTP 가능** |
| 0x1A | **Feedback Control** | [7] N_ERM_LRA (0=ERM, 1=LRA), [6:4] FB_BRAKE_FACTOR, [3:2] LOOP_GAIN, [1:0] BEMF_GAIN. **OTP 가능** |

> **OTP**: One-Time Programmable. 한 번 쓰면 파워사이클 후에도 유지. 0x16~0x1A만 해당.

### 3.5 제어 레지스터 (0x1B–0x20)

| Addr | 이름 | 주요 비트 | 설명 |
|---|---|---|---|
| 0x1B | **Control1** | [4:0] DRIVE_TIME, [5] AC_COUPLE, [7] STARTUP_BOOST | DRIVE_TIME: LRA 반주기 시간 설정 |
| 0x1C | **Control2** | [1:0] IDISS_TIME, [3:2] BLANKING_TIME, [5:4] SAMPLE_TIME, [6] BRAKE_STABILIZER, [7] BIDIR_INPUT | 입력 양방향/단방향, 샘플 타이밍 |
| 0x1D | **Control3** | [0] LRA_OPEN_LOOP, [1] N_PWM_ANALOG, [2] LRA_DRIVE_MODE, [3] DATA_FORMAT_RTP, [5] SUPPLY_COMP_DIS, [7:6] NG_THRESH | 오픈루프, PWM/아날로그 선택, RTP 데이터 포맷 |
| 0x1E | **Control4** | [1:0] OTP_PROGRAM, [3:2] OTP_STATUS, [5:4] AUTO_CAL_TIME, [7:6] ZC_DET_TIME | OTP 프로그래밍, 캘리 시간 |
| 0x1F | **Control5** | [0] PLAYBACK_INTERVAL, [1] LRA_AUTO_OPEN_LOOP, [3:2] AUTO_OL_CNT | 재생 간격 (5ms/1ms), 자동 오픈루프 전환 |
| 0x20 | **OL_LRA_Period** | [6:0] OL_LRA_PERIOD | LRA 오픈루프 주파수: f = 1/(OL_LRA_PERIOD × 98.46µs) |

### 3.6 읽기 전용 / 배터리 (0x21–0x22)

| Addr | 이름 | 설명 |
|---|---|---|
| 0x21 | **VBAT** | VDD 전압 모니터링. V = VBAT[7:0] × 5.6V / 255 |
| 0x22 | **LRA Resonance Period** | LRA 공진 주기 실시간 리포팅. 구동 중에만 유효 |

---

## 4. 모드별 Quick Setup

### 4.1 RTP 모드 (ESP32에서 가장 많이 사용)

```cpp
// 1. Standby 해제 + RTP 모드
writeReg(0x01, 0x05);   // STANDBY=0, MODE=5(RTP)

// 2. 피드백 제어 (LRA 예시)
writeReg(0x1A, 0xB6);   // N_ERM_LRA=1(LRA), FB_BRAKE_FACTOR=3, LOOP_GAIN=1, BEMF_GAIN=2

// 3. 진폭 쓰기
writeReg(0x02, amplitude);  // 0~127(signed) or 0~255(unsigned)

// 4. 정지
writeReg(0x02, 0x00);
```

### 4.2 ROM Library 모드 (Internal Trigger)

```cpp
writeReg(0x01, 0x00);   // STANDBY=0, MODE=0(Internal Trigger)
writeReg(0x03, 0x06);   // Library = 6 (LRA)
writeReg(0x04, 1);      // Seq1: Effect #1 (Strong Click)
writeReg(0x05, 0);      // Seq2: Stop
writeReg(0x0C, 0x01);   // GO!
```

### 4.3 Auto Calibration

```cpp
writeReg(0x01, 0x07);   // MODE=7(Auto Cal)
writeReg(0x16, rated);  // Rated Voltage
writeReg(0x17, clamp);  // Overdrive Clamp
writeReg(0x1A, fb_ctl); // Feedback Control (ERM/LRA 선택 포함)
writeReg(0x1B, ctrl1);  // Control1 (DRIVE_TIME 등)
writeReg(0x0C, 0x01);   // GO → 캘리브레이션 시작
// GO 비트가 자동 클리어될 때까지 폴링
// 결과: 0x18(COMP), 0x19(BEMF), 0x1A(BEMF_GAIN) 저장
```

---

## 5. RTP 데이터 포맷

Control3(0x1D)의 **DATA_FORMAT_RTP** 비트(bit 3)로 선택:

| DATA_FORMAT_RTP | 포맷 | 범위 | 설명 |
|---|---|---|---|
| 0 (기본) | **Signed** | –128 ~ +127 | 양방향 구동. 0=정지, +127=전방향 최대, –128=역방향 최대 |
| 1 | **Unsigned** | 0 ~ 255 | 단방향 구동. 0=정지, 255=최대. BIDIR_INPUT=0과 함께 사용 |

> **ESP32 RTP 패턴 에디터에서**: unsigned 모드(DATA_FORMAT_RTP=1, BIDIR_INPUT=0) 사용 시 0~255 전 범위 활용 가능

---

## 6. 라이브러리 선택 (0x03)

| LIBRARY_SEL | 대상 | 루프 | 비고 |
|---|---|---|---|
| 0 | Empty | — | 사용자 ROM 없음 |
| 1 | ERM Library A | Open | Rated 1.3V, OD 3V |
| 2 | ERM Library B | Open | Rated 3V, 빠른 브레이크 |
| 3 | ERM Library C | Open | Rated 3V, 중간 |
| 4 | ERM Library D | Open | Rated 3V, 느린 |
| 5 | ERM Library E | Open | Rated 3V, 매우 느린 |
| 6 | **LRA Library** | **Closed** | LRA 전용. 가장 많이 사용 |
| 7 | ERM Library F | Open | Rated 4.5V, OD 5V |

---

## 7. 내장 이펙트 라이브러리 (ID 1~123)

> → **별도 파일 참조**: `DRV2605L_Effect_Library.md`

---

## 8. Control1~3 레지스터 비트 상세

### 8.1 Control1 (0x1B)

| 비트 | 이름 | 기본 | 설명 |
|---|---|---|---|
| 7 | STARTUP_BOOST | 1 | 1=시작 시 과도 응답에 높은 루프 게인 적용 (빠른 기동) |
| 6 | *reserved* | 0 | — |
| 5 | AC_COUPLE | 0 | 1=IN/TRIG 핀 AC 커플링 활성 (Audio-to-Vibe 시 사용). CM=0.9V |
| 4:0 | **DRIVE_TIME** | 0x13 | LRA 반주기 시간. ERM에서는 Back-EMF 샘플링 주기 결정 |

#### DRIVE_TIME 값 → 시간 / LRA 주파수 매핑

```
시간 = DRIVE_TIME[4:0] × 0.1ms + 0.5ms
LRA 공진주파수 ≈ 1 / (2 × 시간)
```

| DRIVE_TIME | 시간 (ms) | LRA 주파수 (Hz) | 적용 예 |
|---|---|---|---|
| 0x00 | 0.5 | 1000 | — |
| 0x06 | 1.1 | ~455 | — |
| 0x0A | 1.5 | ~333 | — |
| 0x0F | 2.0 | 250 | 250Hz LRA |
| **0x11** | **2.2** | **~227** | **VLV221007E (230Hz)** |
| **0x13** | **2.4** | **~208** | **기본값. ~205Hz LRA** |
| 0x17 | 2.8 | ~179 | — |
| **0x18** | **2.9** | **~172** | **VG1040003D (170Hz)** |
| 0x19 | 3.0 | ~167 | — |
| 0x1F | 3.6 | ~139 | 140Hz LRA |

> **Tip**: LRA 공진주파수에 맞게 DRIVE_TIME을 세팅해야 Auto-Resonance가 빠르게 락온함.  
> 예: 175Hz LRA → 반주기 = 1/(2×175) = 2.86ms → DRIVE_TIME = (2.86-0.5)/0.1 = 23.6 → **0x18**

### 8.2 Control2 (0x1C)

| 비트 | 이름 | 기본 | 설명 |
|---|---|---|---|
| 7 | **BIDIR_INPUT** | 1 | 1=양방향 입력 (signed). 0=단방향 (unsigned). RTP/PWM 모두 적용 |
| 6 | BRAKE_STABILIZER | 1 | 1=브레이크 완료 직전 루프 게인 자동 감소 (안정화) |
| 5:4 | **SAMPLE_TIME** | 11 (3) | Back-EMF 샘플 시간. 높을수록 게인↑, 정확도↑ |
| 3:2 | **BLANKING_TIME** | 01 (1) | Back-EMF 블랭킹 시간. AD 변환 전 안정화 대기 |
| 1:0 | **IDISS_TIME** | 01 (1) | 전류 소산 시간. 하이임피던스 전환 전 대기 |

#### SAMPLE_TIME / BLANKING_TIME / IDISS_TIME 값 테이블

| 값 | SAMPLE_TIME | BLANKING_TIME | IDISS_TIME |
|---|---|---|---|
| 0 | 150µs | 45µs | 45µs |
| 1 | 200µs | 75µs | 75µs |
| 2 | 250µs | 150µs | 150µs |
| 3 | 300µs | 225µs | 225µs |

> **주의**: BLANKING_TIME + IDISS_TIME이 너무 크면 한 주기 내 구동 시간이 줄어듦.  
> LRA Closed-Loop에서는 기본값(3, 1, 1)이 대부분 적절함.

### 8.3 Control3 (0x1D)

| 비트 | 이름 | 기본 | 설명 |
|---|---|---|---|
| 7:6 | **NG_THRESH** | 10 (2) | 노이즈 게이트 임계값 (PWM/Analog 입력 잡음 차단) |
| 5 | ERM_OPEN_LOOP | 0 | 1=ERM 오픈루프 동작 |
| 4 | SUPPLY_COMP_DIS | 0 | 1=전원 보상 비활성. 0=배터리 방전 보상 활성 |
| 3 | **DATA_FORMAT_RTP** | 0 | 0=Signed(–128~+127). 1=Unsigned(0~255) |
| 2 | LRA_DRIVE_MODE | 0 | 0=주기당 1회 BEMF 샘플. 1=주기당 2회 |
| 1 | **N_PWM_ANALOG** | 0 | MODE=3일 때: 0=PWM, 1=Analog |
| 0 | **LRA_OPEN_LOOP** | 0 | 1=LRA 오픈루프 (BEMF 무시, OL_LRA_PERIOD 주파수 사용) |

#### NG_THRESH 노이즈 게이트 값

| 값 | 임계 (% of full-scale) | 용도 |
|---|---|---|
| 0 | Disabled | 노이즈 게이트 끔 |
| 1 | 2% | 저잡음 환경 |
| **2** | **4%** | **기본값. 대부분 적절** |
| 3 | 8% | 고잡음 환경 |

---

## 9. ERM vs LRA 설정 비교표

### 핵심 레지스터 차이

| 항목 | ERM | LRA |
|---|---|---|
| **N_ERM_LRA** (0x1A bit7) | `0` | `1` |
| **ERM_OPEN_LOOP** (0x1D bit5) | 0=Closed / 1=Open | 무관 (0) |
| **LRA_OPEN_LOOP** (0x1D bit0) | 무관 (0) | 0=Closed / 1=Open |
| **DRIVE_TIME** (0x1B) | BEMF 샘플 주기 | LRA 반주기 (공진주파수 힌트) |
| **Library** (0x03) | 1~5, 7 (ERM A~F) | 6 (LRA) |
| Auto-Resonance | 해당 없음 | 자동 주파수 추적 (Closed-Loop) |
| RATED_VOLTAGE 해석 | 평균 전압 | RMS 전압 |

### Closed-Loop vs Open-Loop

| | Closed-Loop | Open-Loop |
|---|---|---|
| **BEMF 피드백** | 사용 (자동 오버드라이브/브레이크) | 사용 안 함 |
| **캘리브레이션** | 필수 (Auto Cal) | 불필요 |
| **RATED_VOLTAGE** | 정격 전압 기준 | 무시됨 (OD_CLAMP 사용) |
| **LRA 주파수** | 자동 추적 | OL_LRA_PERIOD 또는 PWM÷128 |
| **장점** | 일관된 진동 강도, 빠른 기동/정지 | 설정 간단, 공진 외 주파수 구동 가능 |
| **단점** | 캘리 필요, 설정 복잡 | 진동 강도 불일치 가능, 오버드라이브 수동 |

### 전형적 설정 예시

```cpp
// ===== LRA Closed-Loop (추천) =====
writeReg(0x1A, 0xB6);  // N_ERM_LRA=1, BRAKE_FACTOR=3, LOOP_GAIN=1, BEMF_GAIN=2
writeReg(0x1B, 0x93);  // STARTUP_BOOST=1, DRIVE_TIME=0x13 (~208Hz)
writeReg(0x1C, 0xF5);  // BIDIR=1, BRAKE_STAB=1, SAMPLE=3, BLANK=1, IDISS=1
writeReg(0x1D, 0xA0);  // NG_THRESH=2, 나머지 0 (closed-loop, signed RTP)

// ===== ERM Open-Loop =====
writeReg(0x1A, 0x36);  // N_ERM_LRA=0, BRAKE_FACTOR=3, LOOP_GAIN=1, BEMF_GAIN=2
writeReg(0x1D, 0xA0);  // ERM_OPEN_LOOP=0 → 실제로는 Library 모드에서 자동 Open
// ERM Library 사용 시 open-loop이 권장됨 (데이터시트)
```

---

## 10. Waveform Sequencer 상세

### 구조 (레지스터 0x04 ~ 0x0B)

각 시퀀스 레지스터는 8비트이며, MSB에 따라 동작이 달라짐:

```
비트 7 = 0: 이펙트 재생
  [6:0] = 이펙트 ID (1~123). 0이면 시퀀스 종료.

비트 7 = 1: 딜레이 삽입
  [6:0] = 대기 시간. 딜레이 = 값 × 10ms (10ms ~ 1270ms)
```

### 시퀀스 동작 흐름

```
GO=1 → Seq1(0x04) 재생
         ↓
       Seq2(0x05) ── 값이 0이면 종료
         ↓
       Seq3(0x06) ── ...
         ↓
       ... 최대 Seq8(0x0B)까지
         ↓
       GO 자동 클리어
```

### 예제들

```cpp
// ── 예제 1: 단일 이펙트 ──
writeReg(0x04, 1);    // Strong Click 100%
writeReg(0x05, 0);    // 종료
writeReg(0x0C, 0x01); // GO

// ── 예제 2: 더블 클릭 (수동 구성) ──
writeReg(0x04, 1);         // Seq1: Strong Click
writeReg(0x05, 0x80 | 10); // Seq2: 딜레이 100ms (10 × 10ms, MSB=1)
writeReg(0x06, 1);         // Seq3: Strong Click
writeReg(0x07, 0);         // Seq4: 종료
writeReg(0x0C, 0x01);      // GO

// ── 예제 3: 알림 패턴 ──
writeReg(0x04, 14);        // Seq1: Sharp Tick 80%
writeReg(0x05, 0x80 | 30); // Seq2: 딜레이 300ms
writeReg(0x06, 47);        // Seq3: Alert Pattern 5
writeReg(0x07, 0x80 | 50); // Seq4: 딜레이 500ms
writeReg(0x08, 52);        // Seq5: Medium Impact
writeReg(0x09, 0);         // Seq6: 종료
writeReg(0x0C, 0x01);      // GO

// ── 예제 4: 최대 딜레이 ──
writeReg(0x04, 1);          // 이펙트
writeReg(0x05, 0x80 | 127); // 딜레이 1270ms (최대)
writeReg(0x06, 1);          // 이펙트
writeReg(0x07, 0);          // 종료
```

### 딜레이 값 참조표

| [6:0] 값 | 딜레이 | | [6:0] 값 | 딜레이 |
|---|---|---|---|---|
| 1 | 10 ms | | 50 | 500 ms |
| 5 | 50 ms | | 75 | 750 ms |
| 10 | 100 ms | | 100 | 1000 ms |
| 25 | 250 ms | | 127 | 1270 ms |

### Time Offset으로 ROM 파형 커스터마이즈

| Addr | 이름 | 역할 | 범위 |
|---|---|---|---|
| 0x0D | ODT Offset | 오버드라이브 시간 ±보정 | signed 8bit (–128~+127) ms단위 |
| 0x0E | SPT Offset | Sustain(+) 시간 보정 | 〃 |
| 0x0F | SNT Offset | Sustain(–) 시간 보정 | 〃 |
| 0x10 | BRT Offset | 브레이크 시간 보정 | 〃 |

> 기본 재생 간격은 **5ms**. PLAYBACK_INTERVAL(0x1F bit0)=1로 세팅하면 **1ms** 간격으로 변경 가능.

---

## 11. Status 레지스터 디버깅 & 보호 기능

### Status 레지스터 (0x00) 비트 맵

| 비트 | 이름 | 의미 |
|---|---|---|
| 7:5 | DEVICE_ID | 디바이스 식별. **DRV2605L = 0b111 (7) → 상위 3비트 = 0xE0** |
| 4 | *reserved* | — |
| 3 | **DIAG_RESULT** | 마지막 캘리/진단 결과. **0=성공, 1=실패**. 읽으면 클리어 |
| 2 | *reserved* | — |
| 1 | **OVER_TEMP** | **1=과열 감지 → 자동 셧다운 발생 중** |
| 0 | **OC_DETECT** | **1=과전류 감지 → 출력 단락 상태** |

> 정상 상태에서 Status = **0xE0** (DEVICE_ID=7, 나머지 0)

### 디버깅 체크리스트

```
Status 읽기 → 0xE0이 아니면?

├─ DIAG_RESULT = 1 (bit 3)
│   ├─ Auto Cal 실패?
│   │   ├─ RATED_VOLTAGE / OD_CLAMP 값 확인
│   │   ├─ N_ERM_LRA 설정이 실제 액추에이터와 일치하는지
│   │   ├─ DRIVE_TIME이 LRA 공진주파수와 맞는지
│   │   ├─ 액추에이터가 물리적으로 연결되어 있는지
│   │   └─ BEMF_GAIN / SAMPLE_TIME 조정 시도
│   └─ Diagnostics 실패?
│       ├─ 액추에이터 개방 (미연결)
│       └─ 출력 핀 단락
│
├─ OVER_TEMP = 1 (bit 1)
│   ├─ 장시간 고진폭 연속 구동 시 발생 가능
│   ├─ 방열 확인, 듀티사이클 낮추기
│   └─ 온도 내려가면 자동 복구
│
└─ OC_DETECT = 1 (bit 0)
    ├─ OUT+/OUT– 핀 단락 (GND, VDD, 또는 서로)
    ├─ 부하 임피던스 < 4Ω
    ├─ 단락 제거 시 자동 복구 (default state로 리셋)
    └─ 구동 중이 아닌 idle 상태에서는 감지 안 됨 주의
```

### I²C Watchdog 타이머

- I²C 전송이 중간에 끊기면 **4.33ms** 후 자동으로 I²C 프로토콜 리셋
- **예외**: Standby 모드에서는 워치독 미동작 → 파워사이클만 복구 가능
- **대응**: Standby 진입 전에 I²C 트랜잭션이 완료되었는지 확인

### 과전류 보호 동작

```
OUT+/OUT– 단락 발생
  ↓
OC_DETECT = 1 (래치)
  ↓
출력 자동 셧다운
  ↓
주기적으로 단락 상태 확인
  ↓ (단락 제거됨)
DRV2605L 자동 리셋 → Default state
```

### Brownout (저전압) 보호

```
VDD 강하
  ↓
V(REG) < V(BOT) ≈ 0.84V
  ↓
리셋 신호 → 모든 레지스터 초기화
  ↓
V(REG) → 1.8V 복구 시 default state로 재시작
```

> ⚠️ **VDD 슬루레이트 주의**:  
> - **> 3.6 kV/s**: 정상 복구 (Case 1, Case 4)  
> - **< 3.6 kV/s**: Unknown state 진입 가능 → 파워사이클 필요  
> - 배터리 직결 시 느린 방전 → brownout → unknown state 리스크  
> - **대응**: 전원에 충분한 바이패스 캡(1µF) 확보, 가능하면 EN 핀으로 제어

### OTP 프로그래밍 주의사항

> ⚠️ **OTP는 비가역적**  
> - 0x16~0x1A 레지스터만 OTP 가능  
> - Control4(0x1E)의 OTP_PROGRAM 비트로 실행  
> - **프로토타이핑 중에는 절대 OTP 쓰지 말 것**  
> - 대안: 호스트(ESP32)에서 캘리 결과를 Flash/NVS에 저장하고 부팅 시 재기록

---

## 12. 주요 공식

### Rated Voltage 계산 (LRA, Closed-Loop)

```
V_RATED_REG = V_RATED × √(1 - 4×DRIVE_TIME×f + 300µs×f) / (0.02071 × √(1 - f×(IDISS_TIME + BLANKING_TIME)))

간략화: V_RATED_REG ≈ V_RATED / 0.02071   (1.8V LRA → ≈87 = 0x57)
```

### Overdrive Clamp 계산 (LRA, Closed-Loop)

```
OD_CLAMP_REG ≈ V_OD / 0.02196   (2.0V clamp → ≈91 = 0x5B)
```

### LRA Open-Loop 주파수

```
f_OL = 1 / (OL_LRA_PERIOD[6:0] × 98.46µs)
예: 205Hz → OL_LRA_PERIOD = 1/(205 × 98.46µs) ≈ 50 = 0x32
```

### VBAT 전압 계산

```
V_BAT = VBAT[7:0] × 5.6V / 255
```

---

## 13. 초기화 시퀀스 요약

```
Power On
  ↓
250µs 대기 (내부 시작). nACK 시 재시도.
  ↓
EN 핀 HIGH
  ↓
0x01 ← 0x07 (Auto Calibration 모드)   ← 최초 1회 or 매 부팅
  ↓
0x16 ← Rated Voltage
0x17 ← OD Clamp
0x1A ← Feedback Control (ERM/LRA 선택)
0x1B ← Control1 (DRIVE_TIME)
0x1C ← Control2
0x1D ← Control3
  ↓
0x0C ← 0x01 (GO) → 캘리 실행
  ↓
GO=0 될 때까지 폴링
  ↓
0x00 읽기 → DIAG_RESULT 확인 (0=성공)
  ↓
캘리 결과 저장: 0x18, 0x19, 0x1A[1:0]
  ↓
원하는 모드로 전환 (예: 0x01 ← 0x05 for RTP)
  ↓
운용 시작
```

---

*참고: TI DRV2605L Datasheet (SLOS854D), TI Application Note SLOA189*
