#include <Wire.h>

#define SDA_PIN         21
#define SCL_PIN         22

#define TCA_ADDR        0x70
#define DRV2605L_ADDR   0x5A

#define REG_MODE        0x01
#define REG_RTP_INPUT   0x02
#define REG_LIB         0x03
#define REG_WAVESEQ1    0x04
#define REG_GO          0x0C
#define REG_RATED_V     0x16
#define REG_OD_CLAMP    0x17
#define REG_FEEDBACK    0x1A
#define REG_CTRL1       0x1B
#define REG_CTRL2       0x1C
#define REG_CONTROL3    0x1D

#define MAX_SEQ         8
#define MAX_CHANNELS    8

// ── 채널별 모터 설정 ────────────────────────────────────────────────
struct MotorConfig {
  const char* name;
  uint8_t     rated_v;    // REG_RATED_V
  uint8_t     od_clamp;   // REG_OD_CLAMP
  uint8_t     ctrl1;      // REG_CTRL1: STARTUP_BOOST | DRIVE_TIME
  uint8_t     ctrl2;      // REG_CTRL2
};

// CH0: VG1040003D 170Hz / CH1: VLV221007E 230Hz / 나머지: 기본값
const MotorConfig MOTOR_CFG[MAX_CHANNELS] = {
  // name            rated_v  od_clamp  ctrl1               ctrl2
  { "VG1040003D",    0x3C,    0x89,     0x80 | 0x1C, 0xF5 },  // CH0 170Hz
  { "VLV221007E",    0x3C,    0x89,     0x80 | 0x14, 0xF5 },  // CH1 230Hz
  { "DEFAULT",       0x3C,    0x89,     0x80 | 0x1C, 0xF5 },  // CH2
  { "DEFAULT",       0x3C,    0x89,     0x80 | 0x1C, 0xF5 },  // CH3
  { "DEFAULT",       0x3C,    0x89,     0x80 | 0x1C, 0xF5 },  // CH4
  { "DEFAULT",       0x3C,    0x89,     0x80 | 0x1C, 0xF5 },  // CH5
  { "DEFAULT",       0x3C,    0x89,     0x80 | 0x1C, 0xF5 },  // CH6
  { "DEFAULT",       0x3C,    0x89,     0x80 | 0x1C, 0xF5 },  // CH7
};


// ── TCA9548A ────────────────────────────────────────────────────────
void tcaSelect(uint8_t ch) {
  if (ch >= 8) return;
  Wire.beginTransmission(TCA_ADDR);
  Wire.write(1 << ch);
  Wire.endTransmission();
}

void tcaDisableAll() {
  Wire.beginTransmission(TCA_ADDR);
  Wire.write(0x00);
  Wire.endTransmission();
}


// ── DRV2605L 레지스터 I/O ────────────────────────────────────────────
void writeReg(uint8_t reg, uint8_t val) {
  Wire.beginTransmission(DRV2605L_ADDR);
  Wire.write(reg);
  Wire.write(val);
  uint8_t err = Wire.endTransmission();
  if (err != 0) {
    Serial.printf("  [ERR] I2C WRITE reg=0x%02X val=0x%02X err=%d\n", reg, val, err);
  }
}

uint8_t readReg(uint8_t reg) {
  Wire.beginTransmission(DRV2605L_ADDR);
  Wire.write(reg);
  uint8_t err = Wire.endTransmission(false);
  if (err != 0) {
    Serial.printf("  [ERR] I2C READ reg=0x%02X err=%d\n", reg, err);
    return 0xFF;
  }
  Wire.requestFrom((uint8_t)DRV2605L_ADDR, (uint8_t)1);
  return Wire.available() ? Wire.read() : 0xFF;
}


// ── DRV2605L 초기화 (채널별 모터 설정 적용) ─────────────────────────
bool initDrvOnChannel(uint8_t ch) {
  if (ch >= MAX_CHANNELS) return false;
  const MotorConfig& cfg = MOTOR_CFG[ch];

  tcaSelect(ch);
  delay(2);

  // 응답 확인
  uint8_t status = readReg(REG_MODE);
  if (status == 0xFF) {
    Serial.printf("[CH%d] DRV2605L 응답 없음\n", ch);
    return false;
  }

  // 1. 소프트 리셋
  writeReg(REG_MODE, 0x80);
  delay(10);

  // 2. Standby 해제 + Internal Trigger 모드
  writeReg(REG_MODE, 0x00);
  delay(5);

  // 3. LRA 피드백 고정값 (OR 연산 금지 - 이전 캘리브레이션 값 누적 방지)
  writeReg(REG_FEEDBACK, 0xB6);  // LRA | 브레이크 ON | BEMF_GAIN=10

  // 4. 정격전압 / 최대전압
  writeReg(REG_RATED_V,  cfg.rated_v);
  writeReg(REG_OD_CLAMP, cfg.od_clamp);

  // 5. CTRL1: STARTUP_BOOST + 모터별 DRIVE_TIME
  writeReg(REG_CTRL1, cfg.ctrl1);

  // 6. CTRL2: 샘플링 타임
  writeReg(REG_CTRL2, cfg.ctrl2);

  // 7. CONTROL3: LRA 오픈루프 (N_PWM_ANALOG=0 필수)
  //    0xA0 = 1010 0000 (bit1=0 → 아날로그 입력 OFF)
  writeReg(REG_CONTROL3, 0xA0);

  // 8. LRA 라이브러리
  writeReg(REG_LIB, 0x06);

  delay(5);

  Serial.printf("[CH%d] %-12s 초기화 완료 | MODE=0x%02X FB=0x%02X CTRL1=0x%02X\n",
                ch, cfg.name,
                readReg(REG_MODE),
                readReg(REG_FEEDBACK),
                readReg(REG_CTRL1));
  return true;
}


// ── 시퀀스 적재 ─────────────────────────────────────────────────────
bool loadSequenceToChannel(uint8_t ch, uint8_t* ids, uint8_t count) {
  if (ch >= MAX_CHANNELS) return false;
  count = min(count, (uint8_t)MAX_SEQ);
  if (count == 0) return false;

  tcaSelect(ch);
  delayMicroseconds(200);

  writeReg(REG_MODE, 0x00);
  writeReg(REG_LIB,  0x06);

  for (uint8_t i = 0; i < count; i++) {
    writeReg(REG_WAVESEQ1 + i, ids[i]);
  }
  for (uint8_t i = count; i < MAX_SEQ; i++) {
    writeReg(REG_WAVESEQ1 + i, 0x00);
  }

  return true;
}


// ── 트리거 / 완료 대기 ───────────────────────────────────────────────
void triggerChannel(uint8_t ch) {
  tcaSelect(ch);
  delayMicroseconds(150);
  writeReg(REG_GO, 0x01);
}

void waitChannelDone(uint8_t ch, unsigned long timeoutMs = 3000) {
  tcaSelect(ch);
  unsigned long t0 = millis();
  while (readReg(REG_GO) & 0x01) {
    if (millis() - t0 > timeoutMs) {
      Serial.printf("[CH%d] timeout\n", ch);
      return;
    }
    delay(5);
    tcaSelect(ch);
  }
}


// ── 단일 채널 재생 ───────────────────────────────────────────────────
void playSequenceOnChannel(uint8_t ch, uint8_t* ids, uint8_t count) {
  count = min(count, (uint8_t)MAX_SEQ);

  Serial.printf("▶ CH%d [%s] : ", ch, MOTOR_CFG[ch].name);
  for (uint8_t i = 0; i < count; i++) Serial.printf("#%d ", ids[i]);
  Serial.println();

  if (!loadSequenceToChannel(ch, ids, count)) {
    Serial.printf("  [CH%d] 시퀀스 적재 실패\n", ch);
    return;
  }

  triggerChannel(ch);
  waitChannelDone(ch);

  Serial.printf("✓ CH%d 완료\n\n", ch);
}


// ── 동시 재생 ────────────────────────────────────────────────────────
void playDualSequenceNearSimultaneous(
  uint8_t chA, uint8_t* idsA, uint8_t countA,
  uint8_t chB, uint8_t* idsB, uint8_t countB)
{
  countA = min(countA, (uint8_t)MAX_SEQ);
  countB = min(countB, (uint8_t)MAX_SEQ);

  Serial.println("▶ DUAL START");
  Serial.printf("  CH%d [%s]: ", chA, MOTOR_CFG[chA].name);
  for (uint8_t i = 0; i < countA; i++) Serial.printf("#%d ", idsA[i]);
  Serial.println();
  Serial.printf("  CH%d [%s]: ", chB, MOTOR_CFG[chB].name);
  for (uint8_t i = 0; i < countB; i++) Serial.printf("#%d ", idsB[i]);
  Serial.println();

  bool okA = loadSequenceToChannel(chA, idsA, countA);
  bool okB = loadSequenceToChannel(chB, idsB, countB);

  if (!okA || !okB) {
    Serial.println("  시퀀스 적재 실패");
    return;
  }

  unsigned long tStartUs = micros();
  triggerChannel(chA);
  triggerChannel(chB);
  Serial.printf("  Trigger gap: %lu us\n", micros() - tStartUs);

  bool doneA = false, doneB = false;
  unsigned long t0 = millis();

  while (!(doneA && doneB)) {
    if (!doneA) { tcaSelect(chA); if ((readReg(REG_GO) & 0x01) == 0) doneA = true; }
    if (!doneB) { tcaSelect(chB); if ((readReg(REG_GO) & 0x01) == 0) doneB = true; }
    if (millis() - t0 > 4000) { Serial.println("  timeout"); break; }
    delay(3);
  }

  Serial.printf("✓ DUAL DONE (CH%d=%s, CH%d=%s)\n\n",
                chA, doneA ? "done" : "timeout",
                chB, doneB ? "done" : "timeout");
}


// ── 파싱 ────────────────────────────────────────────────────────────
uint8_t parseEffects(String effectsPart, uint8_t* ids) {
  uint8_t count = 0;
  effectsPart.trim();
  int start = 0;

  while (start < (int)effectsPart.length() && count < MAX_SEQ) {
    while (start < (int)effectsPart.length() && effectsPart[start] == ' ') start++;
    if (start >= (int)effectsPart.length()) break;

    int space = effectsPart.indexOf(' ', start);
    if (space == -1) space = effectsPart.length();

    String token = effectsPart.substring(start, space);
    token.trim();

    if (token.length() > 0) {
      int id = token.toInt();
      if (id >= 1 && id <= 123) {
        ids[count++] = (uint8_t)id;
      } else {
        Serial.printf("  ⚠ effect #%d 범위 초과 (1~123)\n", id);
      }
    }
    start = space + 1;
  }
  return count;
}

bool parseChannelCommand(String cmd, uint8_t& ch, uint8_t* ids, uint8_t& count) {
  cmd.trim();
  if (cmd.length() == 0) return false;

  int colon = cmd.indexOf(':');
  if (colon < 0) { Serial.println("  ⚠ 형식: ch:effects"); return false; }

  int chNum = cmd.substring(0, colon).toInt();
  if (chNum < 0 || chNum >= MAX_CHANNELS) {
    Serial.printf("  ⚠ 채널 범위 오류: %d (0~7)\n", chNum);
    return false;
  }

  count = parseEffects(cmd.substring(colon + 1), ids);
  if (count == 0) { Serial.printf("  ⚠ CH%d 유효한 effect 없음\n", chNum); return false; }

  ch = (uint8_t)chNum;
  return true;
}

bool parseDualCommand(String input,
                      uint8_t& chA, uint8_t* idsA, uint8_t& countA,
                      uint8_t& chB, uint8_t* idsB, uint8_t& countB)
{
  if (!input.startsWith("dual ")) return false;
  int sep = input.indexOf('|', 5);
  if (sep < 0) { Serial.println("  ⚠ dual 형식: dual 0:1 2 | 1:47 48"); return false; }

  bool ok1 = parseChannelCommand(input.substring(5, sep), chA, idsA, countA);
  bool ok2 = parseChannelCommand(input.substring(sep + 1),  chB, idsB, countB);

  if (!ok1 || !ok2) return false;
  if (chA == chB) { Serial.println("  ⚠ dual은 서로 다른 채널"); return false; }
  return true;
}


// ── 입력 처리 ────────────────────────────────────────────────────────
void processInputLine(String input) {
  input.trim();
  if (input.length() == 0) return;

  // scan
  if (input.equalsIgnoreCase("scan")) {
    Serial.println("\n=== 채널 스캔 ===");
    for (uint8_t ch = 0; ch < 8; ch++) {
      tcaSelect(ch);
      delay(2);
      uint8_t mode = readReg(REG_MODE);
      Serial.printf("CH%d [%-12s]: %s (MODE=0x%02X)\n",
                    ch, MOTOR_CFG[ch].name,
                    mode == 0xFF ? "없음" : "응답 있음", mode);
    }
    Serial.println();
    return;
  }

  // init
  if (input.equalsIgnoreCase("init")) {
    Serial.println("\n=== 전체 채널 초기화 ===");
    for (uint8_t ch = 0; ch < 8; ch++) initDrvOnChannel(ch);
    Serial.println();
    return;
  }

  // dual
  {
    uint8_t chA, chB, idsA[MAX_SEQ], idsB[MAX_SEQ], countA, countB;
    if (parseDualCommand(input, chA, idsA, countA, chB, idsB, countB)) {
      playDualSequenceNearSimultaneous(chA, idsA, countA, chB, idsB, countB);
      return;
    }
  }

  // 단일/복수 순차
  int start = 0;
  while (start < (int)input.length()) {
    int comma = input.indexOf(',', start);
    if (comma == -1) comma = input.length();

    String part = input.substring(start, comma);
    part.trim();
    if (part.length() > 0) {
      uint8_t ch, ids[MAX_SEQ], count;
      if (parseChannelCommand(part, ch, ids, count))
        playSequenceOnChannel(ch, ids, count);
    }
    start = comma + 1;
  }
}


// ── setup / loop ────────────────────────────────────────────────────
void setup() {
  Serial.begin(921600);
  Wire.begin(SDA_PIN, SCL_PIN);
  Wire.setClock(400000);
  delay(300);

  Serial.println("=== TCA9548A + DRV2605L 듀얼 모터 컨트롤러 ===");
  Serial.println("CH0: VG1040003D (170Hz) / CH1: VLV221007E (230Hz)");
  Serial.println();
  Serial.println("명령어:");
  Serial.println("  scan               채널 감지");
  Serial.println("  init               전체 초기화");
  Serial.println("  0:1 14 47          CH0 순차 재생");
  Serial.println("  0:1 2, 1:47 48     CH0→CH1 순차");
  Serial.println("  dual 0:1 2|1:47 48 동시 재생");
  Serial.println();

  Serial.println("CH0, CH1 초기화 중...");
  initDrvOnChannel(0);
  initDrvOnChannel(1);
  tcaDisableAll();

  Serial.println("\nReady.\n");
}

void loop() {
  if (Serial.available()) {
    String input = Serial.readStringUntil('\n');
    processInputLine(input);
    tcaDisableAll();
  }
}