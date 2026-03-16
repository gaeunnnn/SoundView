/*
 * esp32_haptic_receiver.ino
 * VIB1 포맷 수신 → DRV2605L 진동 출력
 */

#include <Wire.h>

#define DRV_ADDR     0x5A
#define SERIAL_BAUD  921600
#define HEADER_SIZE  12

#define REG_MODE     0x01
#define REG_RTP      0x02
#define REG_LIB      0x03
#define REG_RATED_V  0x16
#define REG_OD_CLAMP 0x17
#define REG_FB_CON   0x1A
#define REG_CTRL1    0x1B
#define REG_CTRL2    0x1C
#define REG_CTRL3    0x1D


// ── DRV2605L ────────────────────────────────────────────────────────
void drv_write(uint8_t reg, uint8_t val) {
  Wire.beginTransmission(DRV_ADDR);
  Wire.write(reg);
  Wire.write(val);
  Wire.endTransmission();
}

uint8_t drv_read(uint8_t reg) {
  Wire.beginTransmission(DRV_ADDR);
  Wire.write(reg);
  Wire.endTransmission(false);
  Wire.requestFrom((uint8_t)DRV_ADDR, (uint8_t)1);
  return Wire.available() ? Wire.read() : 0xFF;
}

void drv_init() {
  drv_write(REG_MODE, 0x80); delay(10);  // 소프트 리셋
  drv_write(REG_MODE, 0x05);             // RTP 모드
  drv_write(REG_LIB,  0x06);             // LRA 라이브러리
  drv_write(REG_FB_CON,   0xB6);
  drv_write(REG_RATED_V,  0x3C);
  drv_write(REG_OD_CLAMP, 0x89);
  drv_write(REG_CTRL1, 0x80 | 0x13);    // 170Hz drive time
  drv_write(REG_CTRL2, 0xF5);
  drv_write(REG_CTRL3, drv_read(REG_CTRL3) | 0x01);  // 오픈루프
  drv_write(REG_RTP, 0x00);
  Serial.println("[DRV] 초기화 완료 (170Hz LRA)");
}


// ── 상태 머신 ────────────────────────────────────────────────────────
enum State { WAIT_HEADER, PLAY };
State state = WAIT_HEADER;

uint8_t  hdr_buf[HEADER_SIZE];
uint8_t  hdr_pos   = 0;
uint32_t n_frames  = 0;
uint32_t frame_idx = 0;
uint16_t fps       = 50;
uint32_t frame_interval_ms = 20;
uint32_t last_frame_ms     = 0;

// 수신 버퍼 (최대 8KB)
#define BUF_SIZE 8192
uint8_t  vib_buf[BUF_SIZE];
uint32_t vib_len   = 0;   // 버퍼에 쌓인 intensity 바이트 수
uint32_t play_pos  = 0;   // 재생 위치


void reset_state() {
  state     = WAIT_HEADER;
  hdr_pos   = 0;
  n_frames  = 0;
  frame_idx = 0;
  vib_len   = 0;
  play_pos  = 0;
  drv_write(REG_RTP, 0x00);
}


// ── 헤더 파싱 ────────────────────────────────────────────────────────
bool parse_header(uint8_t* buf) {
  // 매직 확인
  if (buf[0]!='V' || buf[1]!='I' || buf[2]!='B' || buf[3]!='1') {
    Serial.printf("[ERR] 헤더 불일치: %02X %02X %02X %02X\n",
                  buf[0], buf[1], buf[2], buf[3]);
    return false;
  }

  // fps (uint16 LE)
  fps = (uint16_t)buf[5] | ((uint16_t)buf[6] << 8);

  // n_frames (uint32 LE)
  n_frames = (uint32_t)buf[7]
           | ((uint32_t)buf[8]  << 8)
           | ((uint32_t)buf[9]  << 16)
           | ((uint32_t)buf[10] << 24);

  frame_interval_ms = 1000 / fps;

  Serial.printf("[HDR] fps=%d  frames=%d  재생시간=%.1fs\n",
                fps, n_frames, (float)n_frames / fps);
  return true;
}


// ── setup / loop ────────────────────────────────────────────────────
void setup() {
  Serial.begin(SERIAL_BAUD);
  Wire.begin(21, 22);
  delay(100);
  drv_init();
  Serial.println("[READY] VIB1 패킷 대기 중...");
}

void loop() {
  // ── 시리얼 수신 ──────────────────────────────────────────────────
  while (Serial.available()) {
    uint8_t b = Serial.read();

    if (state == WAIT_HEADER) {
      hdr_buf[hdr_pos++] = b;
      if (hdr_pos == HEADER_SIZE) {
        if (parse_header(hdr_buf)) {
          vib_len  = 0;
          play_pos = 0;
          state    = PLAY;
          Serial.println("[PLAY] 수신 + 재생 시작");
        } else {
          reset_state();
        }
      }
    }
    else if (state == PLAY) {
      if (vib_len < BUF_SIZE) {
        vib_buf[vib_len++] = b;
      }
    }
  }

  // ── 프레임 재생 (타이머 기반) ─────────────────────────────────────
  if (state == PLAY) {
    uint32_t now = millis();
    if (now - last_frame_ms >= frame_interval_ms) {
      last_frame_ms = now;

      if (play_pos < vib_len) {
        uint8_t intensity = vib_buf[play_pos++];
        drv_write(REG_RTP, intensity);

        if (play_pos % 50 == 0) {
          Serial.printf("[PLAY] %d/%d  intensity=%d\n",
                        play_pos, n_frames, intensity);
        }
      }
      else if (play_pos >= n_frames) {
        // 재생 완료
        drv_write(REG_RTP, 0x00);
        Serial.println("[DONE] 재생 완료");
        reset_state();
      }
    }
  }
}