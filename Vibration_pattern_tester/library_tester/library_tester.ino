#include <Wire.h>

#define DRV2605L_ADDR  0x5A
#define REG_MODE       0x01
#define REG_LIB        0x03
#define REG_WAVESEQ1   0x04
#define REG_GO         0x0C
#define REG_FEEDBACK   0x1A
#define REG_CONTROL3   0x1D

void writeReg(uint8_t reg, uint8_t val) {
  Wire.beginTransmission(DRV2605L_ADDR);
  Wire.write(reg);
  Wire.write(val);
  Wire.endTransmission();
}

uint8_t readReg(uint8_t reg) {
  Wire.beginTransmission(DRV2605L_ADDR);
  Wire.write(reg);
  Wire.endTransmission(false);
  Wire.requestFrom((uint8_t)DRV2605L_ADDR, (uint8_t)1);
  if (Wire.available()) return Wire.read();
  return 0xFF;
}

// 최대 8개 시퀀스 재생 (DRV2605L 슬롯 최대 8개)
void playSequence(uint8_t* ids, uint8_t count) {
  count = min(count, (uint8_t)8);

  Serial.print("▶ 재생 순서: ");
  for (int i = 0; i < count; i++) {
    writeReg(REG_WAVESEQ1 + i, ids[i]);
    Serial.printf("#%d ", ids[i]);
  }
  writeReg(REG_WAVESEQ1 + count, 0x00);  // 종료
  Serial.println();

  writeReg(REG_GO, 0x01);
  while (readReg(REG_GO) & 0x01) delay(10);

  Serial.println("✓ 완료\n");
}

// 입력 파싱: "1 14 47 3" → ids 배열로 변환
uint8_t parseInput(String input, uint8_t* ids) {
  uint8_t count = 0;
  input.trim();

  int start = 0;
  while (start < input.length() && count < 8) {
    int space = input.indexOf(' ', start);
    if (space == -1) space = input.length();

    String token = input.substring(start, space);
    token.trim();

    if (token.length() > 0) {
      int id = token.toInt();
      if (id >= 1 && id <= 123) {
        ids[count++] = (uint8_t)id;
      } else {
        Serial.printf("  ⚠ #%d 범위 초과 (1~123), 건너뜀\n", id);
      }
    }
    start = space + 1;
  }
  return count;
}

void setup() {
  Serial.begin(115200);
  Wire.begin(21, 22);
  delay(200);

  writeReg(REG_MODE, 0x00);
  delay(10);
  uint8_t fb = readReg(REG_FEEDBACK);
  fb |= 0x80;
  writeReg(REG_FEEDBACK, fb);
  writeReg(REG_CONTROL3, 0xA3);
  writeReg(REG_LIB, 0x06);
  writeReg(REG_MODE, 0x00);

  Serial.println("=== DRV2605L Effect Tester ===");
  Serial.println("공백으로 구분해서 입력 (최대 8개)");
  Serial.println("예시: 1 14 47 3\n");
}

void loop() {
  if (Serial.available()) {
    String input = Serial.readStringUntil('\n');

    uint8_t ids[8];
    uint8_t count = parseInput(input, ids);

    if (count == 0) {
      Serial.println("유효한 번호가 없어 (1~123)");
      return;
    }

    playSequence(ids, count);
  }
}
