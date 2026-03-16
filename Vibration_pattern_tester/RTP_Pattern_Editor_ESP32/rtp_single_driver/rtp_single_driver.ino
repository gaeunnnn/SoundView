/*
 * rtp_single_driver.ino
 * ═══════════════════════════════════════════════
 * DRV2605L 1개 직결 + RTP Pattern Editor 수신
 * TCA9548A 멀티플렉서 없이 ESP32 ↔ DRV2605L 직접 연결
 *
 * 배선:
 *   ESP32 GPIO21 (SDA) ──→ DRV2605L SDA
 *   ESP32 GPIO22 (SCL) ──→ DRV2605L SCL
 *   ESP32 3.3V ──────────→ DRV2605L VDD
 *   ESP32 GND ───────────→ DRV2605L GND
 *   (4.7kΩ 풀업: SDA→3.3V, SCL→3.3V)
 *   DRV2605L IN/TRIG ───→ GND
 *   DRV2605L REG ────────→ 1µF캡 → GND
 *   DRV2605L OUT+/OUT– ──→ LRA 모터
 *
 * 시리얼: 115200 baud
 * 에디터 프로토콜: "amplitude duration\n"
 * ═══════════════════════════════════════════════
 */

#include <Wire.h>

// ─── 설정 ───
#define SDA_PIN   21
#define SCL_PIN   22
#define DRV_ADDR  0x5A

// ─── DRV2605L 레지스터 ───
#define REG_STATUS        0x00
#define REG_MODE          0x01
#define REG_RTP_INPUT     0x02
#define REG_LIBRARY       0x03
#define REG_WAVESEQ1      0x04
#define REG_GO            0x0C
#define REG_RATED_VOLTAGE 0x16
#define REG_OD_CLAMP      0x17
#define REG_FEEDBACK_CTRL 0x1A
#define REG_CONTROL1      0x1B
#define REG_CONTROL2      0x1C
#define REG_CONTROL3      0x1D
#define REG_OL_LRA_PERIOD 0x20

// ─── 전원 전압 선택 ───
#define VDD_3V3     // 3.3V 전원 (ESP32 직결)
// #define VDD_5V   // 5V 전원 (USB 5V 또는 외부)

// ─── 모터 선택 (하나만 주석 해제) ───
#define MOTOR_VG1040  // 170Hz, 2.5Vrms
// #define MOTOR_VLV221  // 230Hz, 2.3Vrms

// ─── Rise/Fall Time 보상 ───
//   RISE_MS:  0→100% 도달 시간 (모터 물리 특성)
//   FALL_MS:  100%→정지 시간
//   OVERDRIVE_FACTOR: 기동 시 순간 과구동 비율 (1.0 = 없음)
//   BRAKE_ACTIVE: 정지 시 역방향 펄스로 능동 제동
#ifdef MOTOR_VG1040
  #define RISE_MS         10     // VG1040003D: 10ms (50% reach)
  #define FALL_MS         50     // VG1040003D: 50ms (10% reach)
  #define OVERDRIVE_FACTOR 1.4   // 기동 시 40% 오버드라이브
  #define BRAKE_ACTIVE    true   // 능동 제동 사용
#else
  #define RISE_MS         50     // VLV221007E: 50ms (50% reach)
  #define FALL_MS         50     // VLV221007E: 50ms (50% reach)
  #define OVERDRIVE_FACTOR 1.2   // 기동 시 20% 오버드라이브
  #define BRAKE_ACTIVE    true
#endif

// 이전 진폭 (보상 계산용)
uint8_t prevAmp = 0;
unsigned long lastAmpTime = 0;
bool compensationEnabled = false;  // 기본 OFF (진단 후 켜기)

// ────────────────────────────────────────────
// VDD=3.3V 일 때:
//   DRV2605L 출력 최대 = 3.3V
//   정격 2.5Vrms 모터에 2.5V를 쓰면 거의 천장
//   → RATED_V를 낮춰서 다이나믹 레인지 확보
//   → OD_CLAMP도 VDD 이하로 제한
//   → 노이즈 게이트 끄기 (작은 값도 통과시켜야 함)
//
// VDD=5V 일 때:
//   충분한 헤드룸이 있으므로 정격값 그대로 사용
// ────────────────────────────────────────────

#ifdef MOTOR_VG1040
  #define DRIVE_TIME  0x18   // 2.9ms → ~172Hz
  #define OL_PERIOD   0x3C   // 170Hz open-loop
  #ifdef VDD_3V3
    // 3.3V: VDD 대비 여유를 크게 잡아야 closed-loop 캘리가 성공함
    // RATED_V를 정격의 40~50% 수준으로 내림
    // → 0~255 범위가 0~1.2Vrms에 매핑 (약하지만 선형적)
    // → OD_CLAMP로 순간 최대를 좀 더 허용
    #define RATED_V     0x3A   // ~1.2Vrms (공격적 하향)
    #define OD_CLAMP_V  0x56   // ~1.9V 클램프 (3.3V 대비 충분한 헤드룸)
    #define MOTOR_NAME  "VG1040003D 170Hz @3.3V"
  #else
    #define RATED_V     0x79   // 2.5Vrms (정격 그대로)
    #define OD_CLAMP_V  0x7D   // 2.75V 클램프
    #define MOTOR_NAME  "VG1040003D 170Hz @5V"
  #endif
#else  // VLV221007E
  #define DRIVE_TIME  0x11   // 2.2ms → ~227Hz
  #define OL_PERIOD   0x2C   // 230Hz open-loop
  #ifdef VDD_3V3
    #define RATED_V     0x38   // ~1.15Vrms
    #define OD_CLAMP_V  0x56   // ~1.9V 클램프
    #define MOTOR_NAME  "VLV221007E 230Hz @3.3V"
  #else
    #define RATED_V     0x6F   // 2.3Vrms (정격)
    #define OD_CLAMP_V  0x6B   // 2.35V 클램프
    #define MOTOR_NAME  "VLV221007E 230Hz @5V"
  #endif
#endif

// ─── 시리얼 버퍼 ───
char buf[64];
int bufIdx = 0;

// ════════════════════════════════════════
// I²C 유틸
// ════════════════════════════════════════

void drvWrite(uint8_t reg, uint8_t val) {
    Wire.beginTransmission(DRV_ADDR);
    Wire.write(reg);
    Wire.write(val);
    uint8_t err = Wire.endTransmission();
    if (err != 0) {
        Serial.printf("  I2C WRITE ERR: reg=0x%02X val=0x%02X err=%d\n", reg, val, err);
    }
}

uint8_t drvRead(uint8_t reg) {
    Wire.beginTransmission(DRV_ADDR);
    Wire.write(reg);
    uint8_t err = Wire.endTransmission(false);
    if (err != 0) {
        Serial.printf("  I2C READ ERR: reg=0x%02X err=%d\n", reg, err);
        return 0xFF;
    }
    Wire.requestFrom((uint8_t)DRV_ADDR, (uint8_t)1);
    return Wire.available() ? Wire.read() : 0xFF;
}

// ════════════════════════════════════════
// 레지스터 덤프 (디버깅)
// ════════════════════════════════════════

void dumpRegisters() {
    Serial.println("\n── Register Dump ──");
    const char* names[] = {
        "Status", "Mode", "RTP_Input", "Library",
        "WavSeq1", "WavSeq2", "WavSeq3", "WavSeq4",
        "WavSeq5", "WavSeq6", "WavSeq7", "WavSeq8",
        "GO"
    };
    for (uint8_t r = 0x00; r <= 0x0C; r++) {
        Serial.printf("  [0x%02X] %-10s = 0x%02X\n", r, names[r], drvRead(r));
    }
    Serial.printf("  [0x16] RatedV     = 0x%02X\n", drvRead(0x16));
    Serial.printf("  [0x17] OD_Clamp   = 0x%02X\n", drvRead(0x17));
    Serial.printf("  [0x18] A_CAL_COMP = 0x%02X\n", drvRead(0x18));
    Serial.printf("  [0x19] A_CAL_BEMF = 0x%02X\n", drvRead(0x19));
    Serial.printf("  [0x1A] FeedbackCtl= 0x%02X\n", drvRead(0x1A));
    Serial.printf("  [0x1B] Control1   = 0x%02X\n", drvRead(0x1B));
    Serial.printf("  [0x1C] Control2   = 0x%02X\n", drvRead(0x1C));
    Serial.printf("  [0x1D] Control3   = 0x%02X\n", drvRead(0x1D));
    Serial.printf("  [0x1E] Control4   = 0x%02X\n", drvRead(0x1E));
    Serial.printf("  [0x1F] Control5   = 0x%02X\n", drvRead(0x1F));
    Serial.printf("  [0x20] OL_Period  = 0x%02X\n", drvRead(0x20));
    Serial.println("───────────────────");
}

// ════════════════════════════════════════
// DRV2605L 초기화
// ════════════════════════════════════════

bool initDriver() {
    Serial.println("\n[1] Checking device...");

    // 디바이스 리셋
    drvWrite(REG_MODE, 0x80);  // DEV_RESET
    delay(50);

    // ID 확인
    uint8_t status = drvRead(REG_STATUS);
    uint8_t id = (status >> 5) & 0x07;
    Serial.printf("  Status=0x%02X, DeviceID=%d %s\n",
        status, id, id == 7 ? "(DRV2605L OK)" : "(NOT DRV2605L!)");

    if (id != 7) {
        Serial.println("  ERROR: DRV2605L not found!");
        Serial.println("  Check: SDA/SCL wiring, pull-up resistors, VDD power");
        return false;
    }

    // ── Standby 해제 ──
    Serial.println("\n[2] Exiting standby...");
    drvWrite(REG_MODE, 0x00);  // STANDBY=0, MODE=0 (Internal Trigger)
    delay(10);

    // ── Auto Calibration ──
    Serial.println("\n[3] Running auto calibration...");
    Serial.printf("  Motor: %s\n", MOTOR_NAME);
    Serial.printf("  DRIVE_TIME=0x%02X, RATED_V=0x%02X, OD_CLAMP=0x%02X\n",
        DRIVE_TIME, RATED_V, OD_CLAMP_V);

    // VBAT 읽기 (실제 공급 전압 확인)
    drvWrite(REG_MODE, 0x00);  // Active 모드로 잠깐
    delay(10);
    uint8_t vbatReg = drvRead(0x21);
    float vbat = vbatReg * 5.6 / 255.0;
    Serial.printf("  VBAT reading: reg=0x%02X → %.2fV\n", vbatReg, vbat);
    if (vbat < 3.5) {
        Serial.println("  ⚠ Low VDD detected! Dynamic range will be limited.");
        Serial.println("  ⚠ Recommend 5V for full performance.");
    }

    drvWrite(REG_MODE, 0x07);                   // Auto Cal 모드
    drvWrite(REG_RATED_VOLTAGE, RATED_V);
    drvWrite(REG_OD_CLAMP, OD_CLAMP_V);

    #ifdef VDD_3V3
    // 3.3V: BEMF_GAIN을 0으로 낮춰서 저전압 BEMF 감지 성공률 높임
    // LOOP_GAIN도 0(Slow)으로 → 안정성 우선
    drvWrite(REG_FEEDBACK_CTRL, 0x80);          // LRA, BRAKE=0, GAIN=0, BEMF=0
    #else
    drvWrite(REG_FEEDBACK_CTRL, 0xB6);          // LRA, BRAKE=3, GAIN=1, BEMF=2
    #endif

    drvWrite(REG_CONTROL1, 0x80 | DRIVE_TIME);  // STARTUP_BOOST + DRIVE_TIME
    drvWrite(REG_CONTROL2, 0xF5);               // BIDIR=1, BRAKE_STAB=1

    // 캘리는 항상 closed-loop으로 시도 (NG=0, unsigned RTP, closed-loop)
    drvWrite(REG_CONTROL3, 0x08);  // NG=0, DATA_FORMAT_RTP=1, LRA_OPEN_LOOP=0
    Serial.println("  Trying CLOSED-LOOP calibration first...");

    drvWrite(REG_OL_LRA_PERIOD, OL_PERIOD);

    drvWrite(REG_GO, 0x01);  // GO!

    // 완료 대기
    Serial.print("  Calibrating");
    unsigned long t0 = millis();
    while (millis() - t0 < 3000) {
        uint8_t go = drvRead(REG_GO);
        if ((go & 0x01) == 0) break;
        Serial.print(".");
        delay(100);
    }
    Serial.println();

    // 결과 확인
    status = drvRead(REG_STATUS);
    bool ok = !(status & 0x08);

    if (ok) {
        uint8_t comp = drvRead(0x18);
        uint8_t bemf = drvRead(0x19);
        uint8_t fbCtl = drvRead(0x1A);
        Serial.printf("  ★ CAL SUCCESS! COMP=0x%02X, BEMF=0x%02X, FB=0x%02X\n",
            comp, bemf, fbCtl);
        Serial.println("  → CLOSED-LOOP mode active (linear output!)");
        // Control3: closed-loop 유지, NG=0, unsigned RTP
        drvWrite(REG_CONTROL3, 0x08);
    } else {
        Serial.printf("  CAL FAILED (Status=0x%02X)\n", status);
        Serial.println("  → Falling back to OPEN-LOOP mode");
        Serial.println("  ⚠ Open-loop has non-linear output at low amplitudes");
        Serial.println("  ⚠ Strongly recommend: power DRV2605L from 5V");

        // open-loop 폴백
        drvWrite(REG_CONTROL3, 0x09);  // NG=0, unsigned RTP, LRA_OPEN_LOOP=1
    }

    // ── RTP 모드 전환 후 Standby 대기 ──
    Serial.println("\n[4] Switching to RTP mode (standby)...");
    drvWrite(REG_RTP_INPUT, 0);  // 진폭 0 먼저
    drvWrite(REG_MODE, 0x45);    // STANDBY=1 + MODE=5(RTP)
    // → 첫 번째 amp>0 명령이 오면 자동으로 깨어남
    delay(10);

    // 모드 확인
    uint8_t mode = drvRead(REG_MODE);
    Serial.printf("  Mode register = 0x%02X %s\n",
        mode, (mode == 0x45) ? "(RTP+Standby OK)" : "(check!)");

    // 최종 레지스터 덤프
    dumpRegisters();

    return true;
}

// ════════════════════════════════════════
// 시리얼 명령 처리
// ════════════════════════════════════════

void processLine(const char* line) {
    if (line[0] == '\0') return;

    // STOP
    if (strncmp(line, "STOP", 4) == 0) {
        drvWrite(REG_RTP_INPUT, 0);
        drvWrite(REG_MODE, 0x45);  // STANDBY=1 + RTP 유지
        Serial.println("OK STOP (standby)");
        return;
    }

    // STATUS
    if (strncmp(line, "STATUS", 6) == 0) {
        uint8_t st = drvRead(REG_STATUS);
        uint8_t mode = drvRead(REG_MODE);
        uint8_t rtp = drvRead(REG_RTP_INPUT);
        Serial.printf("Status=0x%02X Mode=0x%02X RTP=0x%02X (%d)\n",
            st, mode, rtp, rtp);
        return;
    }

    // DUMP
    if (strncmp(line, "DUMP", 4) == 0) {
        dumpRegisters();
        return;
    }

    // EFFECT id
    if (strncmp(line, "EFFECT", 6) == 0) {
        int effectId = atoi(line + 7);
        if (effectId >= 1 && effectId <= 123) {
            drvWrite(REG_MODE, 0x00);        // Internal Trigger
            drvWrite(REG_LIBRARY, 0x06);     // LRA Library
            drvWrite(REG_WAVESEQ1, effectId);
            drvWrite(REG_WAVESEQ1 + 1, 0);  // 종료
            drvWrite(REG_GO, 0x01);          // 재생

            unsigned long t = millis();
            while (millis() - t < 2000) {
                if ((drvRead(REG_GO) & 0x01) == 0) break;
                delay(5);
            }

            drvWrite(REG_MODE, 0x05);        // RTP 복귀
            drvWrite(REG_RTP_INPUT, 0);      // 진폭 리셋
            Serial.printf("OK EFFECT #%d\n", effectId);
        } else {
            Serial.printf("ERR effect range 1-123, got %d\n", effectId);
        }
        return;
    }

    // COMP ON/OFF (보상 토글)
    if (strncmp(line, "COMP", 4) == 0) {
        const char* arg = line + 5;
        if (strncmp(arg, "ON", 2) == 0) {
            compensationEnabled = true;
            Serial.println("OK compensation ON");
        } else {
            compensationEnabled = false;
            Serial.println("OK compensation OFF");
        }
        return;
    }

    // RESET (수동 재초기화)
    if (strncmp(line, "RESET", 5) == 0) {
        Serial.println("Re-initializing...");
        initDriver();
        return;
    }

    // amp dur (에디터 기본 포맷)
    int amp, dur;
    if (sscanf(line, "%d %d", &amp, &dur) == 2) {
        amp = constrain(amp, 0, 255);
        unsigned long now = millis();

        if (amp == 0) {
            // ═══ 정지 ═══
            if (compensationEnabled && prevAmp > 0 && BRAKE_ACTIVE) {
                drvWrite(REG_RTP_INPUT, 0);
                uint8_t brakeWait = min((int)(FALL_MS * 0.3), 15);
                delay(brakeWait);
            }
            drvWrite(REG_RTP_INPUT, 0);
            drvWrite(REG_MODE, 0x45);  // STANDBY + RTP
            prevAmp = 0;
            lastAmpTime = now;

        } else {
            // ═══ 진동 ═══

            // Standby면 깨우기
            uint8_t curMode = drvRead(REG_MODE);
            if (curMode & 0x40) {
                drvWrite(REG_MODE, 0x05);
                delayMicroseconds(300);
            }

            if (compensationEnabled) {
                // ── 보상 모드 ──
                int delta = (int)amp - (int)prevAmp;

                if (delta > 30 && dur >= RISE_MS) {
                    int overshoot = min((int)(amp * OVERDRIVE_FACTOR), 255);
                    drvWrite(REG_RTP_INPUT, (uint8_t)overshoot);
                    delay(min((int)(RISE_MS * 0.5), 8));
                    drvWrite(REG_RTP_INPUT, (uint8_t)amp);
                } else if (delta < -30 && dur >= 10) {
                    int undershoot = max((int)(amp * 0.5), 0);
                    drvWrite(REG_RTP_INPUT, (uint8_t)undershoot);
                    delay(min((int)(FALL_MS * 0.15), 8));
                    drvWrite(REG_RTP_INPUT, (uint8_t)amp);
                } else {
                    drvWrite(REG_RTP_INPUT, (uint8_t)amp);
                }
            } else {
                // ── 직접 모드 (보상 없음) ──
                drvWrite(REG_RTP_INPUT, (uint8_t)amp);
            }

            prevAmp = amp;
            lastAmpTime = now;
        }
        return;
    }

    Serial.printf("ERR: unknown cmd [%s]\n", line);
}

// ════════════════════════════════════════
// Setup & Loop
// ════════════════════════════════════════

void setup() {
    Serial.begin(115200);
    delay(500);

    Serial.println("\n════════════════════════════════════");
    Serial.println("  RTP Pattern Receiver (Single DRV)");
    Serial.println("════════════════════════════════════");
    Serial.printf("Motor: %s\n", MOTOR_NAME);
    Serial.println("Baud: 115200");

    Wire.begin(SDA_PIN, SCL_PIN);
    Wire.setClock(400000);
    delay(300);

    bool ok = initDriver();

    // ════════════════════════════════════════
    // 자동 진단 테스트
    // 시리얼 모니터에서 결과 확인 후 닫고
    // 에디터로 연결하면 됩니다
    // ════════════════════════════════════════
    Serial.println("\n══ AUTO DIAGNOSTIC TEST ══");
    Serial.println("5초 후 진폭 스윕 테스트 시작...");
    Serial.println("(건너뛰려면 아무 키나 입력)\n");

    unsigned long waitStart = millis();
    bool skip = false;
    while (millis() - waitStart < 5000) {
        if (Serial.available()) {
            while (Serial.available()) Serial.read();
            skip = true;
            break;
        }
        delay(10);
    }

    if (!skip) {
        // 진폭 스윕: 0 → 255까지 10단계
        Serial.println("amp  | response");
        Serial.println("-----|--------");

        uint8_t testAmps[] = {0, 25, 50, 75, 100, 125, 150, 175, 200, 225, 255};

        for (int i = 0; i < 11; i++) {
            uint8_t a = testAmps[i];

            // Standby에서 깨우기
            if (a > 0) {
                drvWrite(REG_MODE, 0x05);
                delayMicroseconds(300);
                drvWrite(REG_RTP_INPUT, a);
            } else {
                drvWrite(REG_RTP_INPUT, 0);
                drvWrite(REG_MODE, 0x45);
            }

            delay(200);  // 안정화 대기

            // RTP 레지스터 실제 값 읽기 확인
            uint8_t readBack = drvRead(REG_RTP_INPUT);
            uint8_t mode = drvRead(REG_MODE);
            uint8_t status = drvRead(REG_STATUS);

            Serial.printf(" %3d | readback=0x%02X mode=0x%02X status=0x%02X",
                a, readBack, mode, status);

            // 상태 플래그
            if (status & 0x08) Serial.print(" DIAG_FAIL");
            if (status & 0x02) Serial.print(" OVER_TEMP");
            if (status & 0x01) Serial.print(" OC_DETECT");
            if (readBack != a && a > 0) Serial.print(" MISMATCH!");
            Serial.println();
        }

        // 정지
        drvWrite(REG_RTP_INPUT, 0);
        drvWrite(REG_MODE, 0x45);

        Serial.println("\n── 최종 레지스터 상태 ──");
        dumpRegisters();
    }

    Serial.println("\n══ DIAGNOSTIC COMPLETE ══");
    Serial.println("시리얼 모니터를 닫고 에디터에서 연결하세요.\n");
    Serial.println("── Commands ──");
    Serial.println("  200 40    - RTP amplitude 200 (from editor)");
    Serial.println("  0 20      - Stop vibration");
    Serial.println("  STOP      - Emergency stop");
    Serial.println("  STATUS    - Read current state");
    Serial.println("  DUMP      - Full register dump");
    Serial.println("  EFFECT 1  - Play built-in effect #1");
    Serial.println("  RESET     - Re-initialize driver");
    Serial.println("\nReady!\n");
}

void loop() {
    while (Serial.available()) {
        char c = Serial.read();
        if (c == '\n' || c == '\r') {
            if (bufIdx > 0) {
                buf[bufIdx] = '\0';
                processLine(buf);
                bufIdx = 0;
            }
        } else if (bufIdx < 62) {
            buf[bufIdx++] = c;
        }
    }
}
