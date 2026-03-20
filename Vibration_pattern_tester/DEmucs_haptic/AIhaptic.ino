/*
 * esp32_haptic_receiver_v3.ino
 * VIB1/VIB2 수신 → TCA9548A → DRV2605L x2 (RTP + 웨이브폼 라이브러리)
 *
 * VIB1: [L_int, R_int] per frame → RTP only
 * VIB2: [L_int, L_sharp, R_int, R_sharp] per frame
 *        sharp > 180 → DRV2605L 라이브러리 트랜지언트 효과 트리거
 *        sharp <= 180 → 일반 RTP
 *
 * Sharpness → DRV2605L 웨이브폼 효과 매핑:
 *   200~255: Strong Click (effect 1) - 날카로운 "딱"
 *   180~199: Sharp Click (effect 4)  - 중간 "톡"
 *   <180:    RTP only                - 부드러운 "웅"
 */

#include <Wire.h>

#define SDA_PIN       21
#define SCL_PIN       22
#define TCA_ADDR      0x70
#define DRV_ADDR      0x5A
#define SERIAL_BAUD   921600
#define HEADER_SIZE   12

// DRV2605L 레지스터
#define REG_MODE      0x01
#define REG_RTP       0x02
#define REG_WAVEFORM  0x04   // 웨이브폼 시퀀스 슬롯 0
#define REG_GO        0x0C
#define REG_LIB       0x03
#define REG_RATED_V   0x16
#define REG_OD_CLAMP  0x17
#define REG_FB_CON    0x1A
#define REG_CTRL1     0x1B
#define REG_CTRL2     0x1C
#define REG_CTRL3     0x1D

// 모터 설정 (VLV221007E 227Hz)
#define MOTOR_RATED_V   0x50
#define MOTOR_OD_CLAMP  0xA4
#define MOTOR_CTRL1     (0x80 | 0x11)
#define MOTOR_CTRL2     0xF5

// 웨이브폼 효과 번호 (DRV2605L 라이브러리)
#define EFFECT_STRONG_CLICK   1
#define EFFECT_SHARP_CLICK    4
#define EFFECT_SOFT_BUMP      7


// ── I2C helpers ─────────────────────────────────────────────────────
void tcaSelect(uint8_t ch) {
  Wire.beginTransmission(TCA_ADDR);
  Wire.write(1 << ch);
  Wire.endTransmission();
}

void tcaSelectBoth() {
  Wire.beginTransmission(TCA_ADDR);
  Wire.write((1 << 0) | (1 << 1));
  Wire.endTransmission();
}

void tcaDisableAll() {
  Wire.beginTransmission(TCA_ADDR);
  Wire.write(0x00);
  Wire.endTransmission();
}

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


// ── DRV 초기화 (RTP 모드) ───────────────────────────────────────────
bool drv_init(uint8_t ch) {
  tcaSelect(ch);
  delay(2);
  if (drv_read(REG_MODE) == 0xFF) {
    Serial.printf("[ERR] CH%d DRV2605L 응답 없음\n", ch);
    return false;
  }
  drv_write(REG_MODE,     0x80);  delay(10);  // 소프트 리셋
  drv_write(REG_MODE,     0x05);  // RTP 모드
  drv_write(REG_LIB,      0x06);  // LRA 라이브러리
  drv_write(REG_FB_CON,   0xB6);
  drv_write(REG_RATED_V,  MOTOR_RATED_V);
  drv_write(REG_OD_CLAMP, MOTOR_OD_CLAMP);
  drv_write(REG_CTRL1,    MOTOR_CTRL1);
  drv_write(REG_CTRL2,    MOTOR_CTRL2);
  drv_write(REG_CTRL3,    0xA1);
  drv_write(REG_RTP,      0x00);
  Serial.printf("[CH%d] 초기화 완료\n", ch);
  return true;
}


// ── RTP 출력 ────────────────────────────────────────────────────────
void drv_set_rtp(uint8_t ch, uint8_t intensity) {
  tcaSelect(ch);
  drv_write(REG_RTP, intensity);
}

// ── 웨이브폼 트리거 (트랜지언트) ────────────────────────────────────
void drv_trigger_effect(uint8_t ch, uint8_t effect_id) {
  tcaSelect(ch);
  // RTP → 트리거 모드 전환
  drv_write(REG_MODE, 0x00);       // Internal trigger 모드
  drv_write(REG_WAVEFORM, effect_id);  // 슬롯 0에 효과
  drv_write(REG_WAVEFORM + 1, 0);     // 슬롯 1 = end
  drv_write(REG_GO, 0x01);            // GO!
  // 효과 재생 후 RTP 모드 복귀는 다음 프레임에서 처리
}

void drv_back_to_rtp(uint8_t ch) {
  tcaSelect(ch);
  drv_write(REG_MODE, 0x05);  // RTP 모드 복귀
}

void drv_stop_both() {
  tcaSelectBoth();
  drv_write(REG_RTP, 0x00);
}


// ── 상태 머신 ───────────────────────────────────────────────────────
enum State { WAIT_HEADER, STREAMING };
State    state = WAIT_HEADER;

uint8_t  hdr_buf[HEADER_SIZE];
uint8_t  hdr_pos = 0;
uint32_t n_frames = 0;
uint16_t fps = 50;
uint8_t  channels = 1;
uint8_t  bytes_per_frame = 2;  // VIB1=2, VIB2=4
bool     is_vib2 = false;

uint8_t  frame_buf[8];
uint8_t  frame_pos = 0;
uint32_t frame_count = 0;
uint32_t stream_start_ms = 0;
uint32_t last_rx_ms = 0;

// 트랜지언트 효과 후 RTP 복귀 플래그
bool ch0_needs_rtp_restore = false;
bool ch1_needs_rtp_restore = false;

#define STREAM_TIMEOUT_MS 2000


void reset_state() {
  state = WAIT_HEADER;
  hdr_pos = 0;
  n_frames = 0;
  frame_pos = 0;
  frame_count = 0;
  ch0_needs_rtp_restore = false;
  ch1_needs_rtp_restore = false;
  drv_stop_both();
  tcaDisableAll();
}


bool parse_header(uint8_t* buf) {
  // VIB1 또는 VIB2
  if (buf[0]=='V' && buf[1]=='I' && buf[2]=='B' && buf[3]=='1') {
    is_vib2 = false;
    bytes_per_frame = 2;
  } else if (buf[0]=='V' && buf[1]=='I' && buf[2]=='B' && buf[3]=='2') {
    is_vib2 = true;
    bytes_per_frame = 4;
  } else {
    Serial.printf("[ERR] 헤더 불일치: %02X %02X %02X %02X\n",
                  buf[0], buf[1], buf[2], buf[3]);
    return false;
  }

  fps      = (uint16_t)buf[5] | ((uint16_t)buf[6] << 8);
  n_frames = (uint32_t)buf[7]  | ((uint32_t)buf[8]  << 8)
           | ((uint32_t)buf[9] << 16) | ((uint32_t)buf[10] << 24);
  channels = buf[11];

  Serial.printf("[HDR] %s fps=%d frames=%d ch=%d bpf=%d 재생=%.1fs\n",
                is_vib2 ? "VIB2" : "VIB1",
                fps, n_frames, channels, bytes_per_frame,
                (float)n_frames / fps);
  return true;
}


// ── 프레임 처리 ─────────────────────────────────────────────────────
void process_frame() {
  uint8_t l_int, l_sharp, r_int, r_sharp;

  if (is_vib2 && bytes_per_frame >= 4) {
    l_int   = frame_buf[0];
    l_sharp = frame_buf[1];
    r_int   = frame_buf[2];
    r_sharp = frame_buf[3];
  } else {
    l_int   = frame_buf[0];
    l_sharp = 0;
    r_int   = (bytes_per_frame >= 2) ? frame_buf[1] : frame_buf[0];
    r_sharp = 0;
  }

  // CH0 (LEFT)
  if (ch0_needs_rtp_restore) {
    drv_back_to_rtp(0);
    ch0_needs_rtp_restore = false;
  }

  if (l_sharp >= 200 && l_int > 100) {
    // High sharpness → 트랜지언트 효과
    drv_trigger_effect(0, EFFECT_STRONG_CLICK);
    ch0_needs_rtp_restore = true;
  } else if (l_sharp >= 180 && l_int > 80) {
    drv_trigger_effect(0, EFFECT_SHARP_CLICK);
    ch0_needs_rtp_restore = true;
  } else {
    drv_set_rtp(0, l_int);
  }

  // CH1 (RIGHT)
  if (ch1_needs_rtp_restore) {
    drv_back_to_rtp(1);
    ch1_needs_rtp_restore = false;
  }

  if (r_sharp >= 200 && r_int > 100) {
    drv_trigger_effect(1, EFFECT_STRONG_CLICK);
    ch1_needs_rtp_restore = true;
  } else if (r_sharp >= 180 && r_int > 80) {
    drv_trigger_effect(1, EFFECT_SHARP_CLICK);
    ch1_needs_rtp_restore = true;
  } else {
    drv_set_rtp(1, r_int);
  }

  frame_count++;

  // 50프레임(1초)마다 로그
  if (frame_count % 50 == 0) {
    uint32_t elapsed = millis() - stream_start_ms;
    float drift_ms = elapsed - (float)frame_count / fps * 1000.0f;

    if (is_vib2) {
      Serial.printf("[STREAM] %d/%d L=%d(s%d) R=%d(s%d) drift=%+.1fms\n",
                    frame_count, n_frames,
                    l_int, l_sharp, r_int, r_sharp, drift_ms);
    } else {
      Serial.printf("[STREAM] %d/%d L=%d R=%d drift=%+.1fms\n",
                    frame_count, n_frames, l_int, r_int, drift_ms);
    }
  }
}


// ── setup / loop ────────────────────────────────────────────────────
void setup() {
  Serial.begin(SERIAL_BAUD);
  Wire.begin(SDA_PIN, SCL_PIN);
  Wire.setClock(400000);
  delay(200);

  Serial.println("=== ESP32 Haptic Receiver v3 ===");
  Serial.println("VIB1 (RTP) + VIB2 (RTP + Waveform Library)");
  Serial.println("CH0: LEFT  / CH1: RIGHT");
  Serial.println();

  drv_init(0);
  drv_init(1);
  tcaDisableAll();

  Serial.println("[READY] VIB1/VIB2 대기 중...");
}

void loop() {
  while (Serial.available()) {
    uint8_t b = Serial.read();

    if (state == WAIT_HEADER) {
      hdr_buf[hdr_pos++] = b;
      if (hdr_pos == HEADER_SIZE) {
        if (parse_header(hdr_buf)) {
          frame_pos = 0;
          frame_count = 0;
          stream_start_ms = millis();
          last_rx_ms = millis();
          state = STREAMING;
          Serial.println("[STREAM] 시작");
        } else {
          reset_state();
        }
      }
    }
    else if (state == STREAMING) {
      last_rx_ms = millis();
      frame_buf[frame_pos++] = b;

      if (frame_pos >= bytes_per_frame) {
        process_frame();
        frame_pos = 0;

        if (frame_count >= n_frames) {
          uint32_t total_ms = millis() - stream_start_ms;
          drv_stop_both();
          Serial.printf("[DONE] %d프레임 완료 (%.1fs)\n",
                        frame_count, total_ms / 1000.0f);
          reset_state();
          return;
        }
      }
    }
  }

  if (state == STREAMING && millis() - last_rx_ms > STREAM_TIMEOUT_MS) {
    drv_stop_both();
    Serial.printf("[TIMEOUT] %d/%d프레임 후 종료\n", frame_count, n_frames);
    reset_state();
  }
}
