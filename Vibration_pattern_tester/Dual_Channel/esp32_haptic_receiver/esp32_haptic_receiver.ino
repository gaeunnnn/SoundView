/*
 * esp32_haptic_receiver.ino
 * VIB1 포맷 수신 → TCA9548A → DRV2605L x2 진동 출력
 *
 * CH0: VLV221007E 227Hz (LEFT)
 * CH1: VLV221007E 227Hz (RIGHT)
 * SDA: GPIO21 / SCL: GPIO22
 */

#include <Wire.h>

// ── 핀 / 주소 ────────────────────────────────────────────────────────
#define SDA_PIN       21
#define SCL_PIN       22
#define TCA_ADDR      0x70
#define DRV_ADDR      0x5A
#define SERIAL_BAUD   921600
#define HEADER_SIZE   12

// ── DRV2605L 레지스터 ────────────────────────────────────────────────
#define REG_MODE      0x01
#define REG_RTP       0x02
#define REG_LIB       0x03
#define REG_RATED_V   0x16
#define REG_OD_CLAMP  0x17
#define REG_FB_CON    0x1A
#define REG_CTRL1     0x1B
#define REG_CTRL2     0x1C
#define REG_CTRL3     0x1D

// ── 모터 설정 (VLV221007E 227Hz) ────────────────────────────────────
// Drive_Time = (1/(2*227) - 0.0005) / 0.0001 ≈ 0x11
#define MOTOR_RATED_V   0x50
#define MOTOR_OD_CLAMP  0xA4
#define MOTOR_CTRL1     (0x80 | 0x11)   // STARTUP_BOOST | DRIVE_TIME(227Hz)
#define MOTOR_CTRL2     0xF5

// ── 수신 버퍼 ────────────────────────────────────────────────────────
// channels=2 이므로 프레임당 2바이트 → 최대 4096프레임 (81.9초 @ 50fps)
#define BUF_SIZE      8192


// ── TCA9548A ────────────────────────────────────────────────────────
void tcaSelect(uint8_t ch) {
  Wire.beginTransmission(TCA_ADDR);
  Wire.write(1 << ch);
  Wire.endTransmission();
}

void tcaSelectBoth() {
  Wire.beginTransmission(TCA_ADDR);
  Wire.write((1 << 0) | (1 << 1));   // CH0 | CH1 동시 활성화
  Wire.endTransmission();
}

void tcaDisableAll() {
  Wire.beginTransmission(TCA_ADDR);
  Wire.write(0x00);
  Wire.endTransmission();
}


// ── DRV2605L I/O ────────────────────────────────────────────────────
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


// ── 채널별 초기화 ────────────────────────────────────────────────────
bool drv_init(uint8_t ch) {
  tcaSelect(ch);
  delay(2);

  if (drv_read(REG_MODE) == 0xFF) {
    Serial.printf("[ERR] CH%d DRV2605L 응답 없음\n", ch);
    return false;
  }

  drv_write(REG_MODE,     0x80);  // 소프트 리셋
  delay(10);
  drv_write(REG_MODE,     0x05);  // RTP 모드
  drv_write(REG_LIB,      0x06);  // LRA 라이브러리
  drv_write(REG_FB_CON,   0xB6);  // LRA | 브레이크 ON (OR 연산 금지)
  drv_write(REG_RATED_V,  MOTOR_RATED_V);
  drv_write(REG_OD_CLAMP, MOTOR_OD_CLAMP);
  drv_write(REG_CTRL1,    MOTOR_CTRL1);
  drv_write(REG_CTRL2,    MOTOR_CTRL2);
  drv_write(REG_CTRL3,    0xA1);  // LRA 오픈루프, N_PWM_ANALOG=0
  drv_write(REG_RTP,      0x00);

  Serial.printf("[CH%d] 초기화 완료 (227Hz VLV221007E)\n", ch);
  return true;
}


// ── 두 채널 동시 RTP 출력 ────────────────────────────────────────────
void drv_set_both(uint8_t intensity_l, uint8_t intensity_r) {
  // CH0 (LEFT)
  tcaSelect(0);
  drv_write(REG_RTP, intensity_l);

  // CH1 (RIGHT)
  tcaSelect(1);
  drv_write(REG_RTP, intensity_r);
}

void drv_stop_both() {
  tcaSelectBoth();
  drv_write(REG_RTP, 0x00);
}


// ── 상태 머신 ────────────────────────────────────────────────────────
enum State { WAIT_HEADER, PLAY };
State    state    = WAIT_HEADER;

uint8_t  hdr_buf[HEADER_SIZE];
uint8_t  hdr_pos  = 0;
uint32_t n_frames = 0;
uint16_t fps      = 50;
uint8_t  channels = 1;
uint32_t frame_interval_ms = 20;
uint32_t last_frame_ms     = 0;

uint8_t  vib_buf[BUF_SIZE];
uint32_t vib_len  = 0;   // 버퍼에 쌓인 바이트 수
uint32_t play_pos = 0;   // 재생 바이트 위치


void reset_state() {
  state     = WAIT_HEADER;
  hdr_pos   = 0;
  n_frames  = 0;
  vib_len   = 0;
  play_pos  = 0;
  drv_stop_both();
  tcaDisableAll();
}


// ── 헤더 파싱 ────────────────────────────────────────────────────────
bool parse_header(uint8_t* buf) {
  if (buf[0]!='V' || buf[1]!='I' || buf[2]!='B' || buf[3]!='1') {
    Serial.printf("[ERR] 헤더 불일치: %02X %02X %02X %02X\n",
                  buf[0], buf[1], buf[2], buf[3]);
    return false;
  }

  fps      = (uint16_t)buf[5] | ((uint16_t)buf[6] << 8);
  n_frames = (uint32_t)buf[7]  | ((uint32_t)buf[8]  << 8)
           | ((uint32_t)buf[9] << 16) | ((uint32_t)buf[10] << 24);
  channels = buf[11];

  frame_interval_ms = 1000 / fps;

  uint32_t total_bytes = n_frames * channels;
  Serial.printf("[HDR] fps=%d  frames=%d  channels=%d  재생시간=%.1fs  총=%d bytes\n",
                fps, n_frames, channels, (float)n_frames / fps, total_bytes);

  if (total_bytes > BUF_SIZE) {
    Serial.printf("[WARN] 버퍼 초과 (%d > %d) - 잘릴 수 있음\n", total_bytes, BUF_SIZE);
  }

  return true;
}


// ── setup / loop ────────────────────────────────────────────────────
void setup() {
  Serial.begin(SERIAL_BAUD);
  Wire.begin(SDA_PIN, SCL_PIN);
  Wire.setClock(400000);
  delay(200);

  Serial.println("=== ESP32 Haptic Receiver (2ch) ===");
  Serial.println("CH0: LEFT  VLV221007E 227Hz");
  Serial.println("CH1: RIGHT VLV221007E 227Hz");
  Serial.println();

  drv_init(0);
  drv_init(1);
  tcaDisableAll();

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

  // ── 프레임 재생 ──────────────────────────────────────────────────
  if (state == PLAY) {
    uint32_t now = millis();
    if (now - last_frame_ms >= frame_interval_ms) {
      last_frame_ms = now;

      uint32_t frame_idx    = play_pos / channels;
      uint32_t bytes_needed = channels;

      if (play_pos + bytes_needed <= vib_len) {
        if (channels >= 2) {
          // 스테레오: L=vib_buf[pos], R=vib_buf[pos+1]
          uint8_t l = vib_buf[play_pos];
          uint8_t r = vib_buf[play_pos + 1];
          drv_set_both(l, r);

          if (frame_idx % 50 == 0) {
            Serial.printf("[PLAY] %d/%d  L=%d  R=%d\n",
                          frame_idx, n_frames, l, r);
          }
        } else {
          // 모노: 두 채널 동일 출력
          uint8_t v = vib_buf[play_pos];
          drv_set_both(v, v);

          if (frame_idx % 50 == 0) {
            Serial.printf("[PLAY] %d/%d  mono=%d\n", frame_idx, n_frames, v);
          }
        }
        play_pos += bytes_needed;
      }
      else if (frame_idx >= n_frames) {
        drv_stop_both();
        Serial.println("[DONE] 재생 완료");
        reset_state();
      }
    }
  }
}
