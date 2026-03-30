/*
 * esp32_relay_haptic.ino
 * ━━━━━━━━━━━━━━━━━━━━━━
 * v3.3 - Relay Client + Dual VG1040003D (170Hz)
 *
 * ★ WebSocketsClient로 릴레이 서버(Nginx+Spring)에 접속
 * ★ TCA9548A + 듀얼 DRV2605L (L/R) 모터 제어
 * ★ 16바이트 프레임 파싱 + 체크섬 검증
 * ★ 단일 고정 버퍼 (setup에서 1회 할당)
 *
 * 프로토콜:
 *   [0xFF, 0xFF, ...frames]   → 데이터 업로드
 *   [0x01, idxHi, idxLo]      → 재생 시작
 *   [0x02]                    → 정지
 *
 * 16바이트 프레임 구조:
 *   [0]  0xAA  [1]  0x55  [2] seq  [3:7] timestamp(u32 LE)
 *   [7]  class [8]  vib_type  [9] frequency
 *   [10] intensity_L  [11] intensity_R
 *   [12:14] duration(u16 LE)  [14:16] checksum(u16 LE)
 *
 * 하드웨어:
 *   ESP32 DevKit V1
 *   TCA9548A (0x70) → CH0: DRV2605L LEFT, CH1: DRV2605L RIGHT
 *   LRA: VG1040003D ×2 (170Hz, VDD=5V)
 */

#define WEBSOCKETS_MAX_DATA_SIZE 65536

#include <WiFi.h>
#include <WebSocketsClient.h>
#include <Wire.h>

// ─── WiFi ───
const char* WIFI_SSID = "DESKTOP-URKE2VL 4883";
const char* WIFI_PASS = "11223344";

// ─── Relay 서버 설정 ───
const char* WS_HOST = "j14e203.p.ssafy.io";
const int   WS_PORT = 80;
const char* WS_PATH = "/dev/api/ws";

WebSocketsClient webSocket;

// ─── I2C ───
#define SDA_PIN       21
#define SCL_PIN       22
#define TCA_ADDR      0x70
#define DRV_ADDR      0x5A
#define CH_LEFT       0
#define CH_RIGHT      1

// ─── DRV2605L 레지스터 ───
#define REG_MODE      0x01
#define REG_RTP       0x02
#define REG_LIB       0x03
#define REG_GO        0x0C
#define REG_RATED_V   0x16
#define REG_OD_CLAMP  0x17
#define REG_FB_CON    0x1A
#define REG_CTRL1     0x1B
#define REG_CTRL2     0x1C
#define REG_CTRL3     0x1D

// ─── 모터 설정 (VG1040003D 170Hz LRA, VDD=5V) ───
//   drive_time = 1/(2×170Hz) = 2.94ms → (2.94-0.5)/0.1 = 24 = 0x18
#define MOTOR_RATED_V   0x56
#define MOTOR_OD_CLAMP  0x89
#define MOTOR_CTRL1     (0x80 | 0x18)
#define MOTOR_CTRL2     0xF5

// ─── 패킷 ───
#define PKT_SIZE      16
#define HEADER_0      0xAA
#define HEADER_1      0x55
#define MAX_FRAMES    1250

// ─── 프로토콜 명령 ───
#define CMD_DATA_0    0xFF
#define CMD_DATA_1    0xFF
#define CMD_PLAY      0x01
#define CMD_PAUSE     0x02

// ─── 단일 고정 버퍼 ─────────────────────────────────────────────────
#define BUF_SIZE      (MAX_FRAMES * PKT_SIZE)   // 20000 bytes
uint8_t*  dataBuf      = nullptr;

// ─── 상태 ───
enum PlayState { ST_STOPPED, ST_PLAYING };

uint16_t  frameCount   = 0;
bool      dataReady    = false;
PlayState playState    = ST_STOPPED;
uint16_t  playIndex    = 0;
uint32_t  framesPlayed = 0;
uint32_t  cksumWarns   = 0;
uint32_t  i2cErrors    = 0;
unsigned long lastFrameTime = 0;
bool      isConnected  = false;

// ─── 청크 누적 상태 ─────────────────────────────────────────────────
size_t        accumLen     = 0;
bool          accumulating = false;
unsigned long lastChunkMs  = 0;

// ═════════════════════════════════════════════════════════════════════
// I2C helpers
// ═════════════════════════════════════════════════════════════════════

void tcaSelect(uint8_t ch) {
    Wire.beginTransmission(TCA_ADDR);
    Wire.write(1 << ch);
    Wire.endTransmission();
}

bool drv_write(uint8_t reg, uint8_t val) {
    Wire.beginTransmission(DRV_ADDR);
    Wire.write(reg);
    Wire.write(val);
    uint8_t err = Wire.endTransmission();
    if (err != 0) {
        i2cErrors++;
        return false;
    }
    return true;
}

uint8_t drv_read(uint8_t reg) {
    Wire.beginTransmission(DRV_ADDR);
    Wire.write(reg);
    Wire.endTransmission(false);
    Wire.requestFrom((uint8_t)DRV_ADDR, (uint8_t)1);
    return Wire.available() ? Wire.read() : 0xFF;
}

// ═════════════════════════════════════════════════════════════════════
// DRV2605L 초기화
// ═════════════════════════════════════════════════════════════════════

bool initDRV2605(uint8_t tcaCh) {
    tcaSelect(tcaCh);
    delay(1);
    drv_write(REG_MODE, 0x00);    // out of standby
    delay(1);
    drv_write(REG_MODE, 0x05);    // RTP mode
    drv_write(REG_LIB, 0x06);     // LRA library
    drv_write(REG_RATED_V, MOTOR_RATED_V);
    drv_write(REG_OD_CLAMP, MOTOR_OD_CLAMP);

    uint8_t fbCon = drv_read(REG_FB_CON);
    fbCon |= 0x80;                // LRA mode
    drv_write(REG_FB_CON, fbCon);

    drv_write(REG_CTRL1, MOTOR_CTRL1);
    drv_write(REG_CTRL2, MOTOR_CTRL2);

    uint8_t ctrl3 = drv_read(REG_CTRL3);
    ctrl3 |= 0x01;                // NG_THRESH
    drv_write(REG_CTRL3, ctrl3);

    drv_write(REG_RTP, 0);        // 초기 출력 0
    Serial.printf("[DRV] CH%d init OK (i2c_err=%u)\n", tcaCh, i2cErrors);
    return true;
}

// ═════════════════════════════════════════════════════════════════════
// 모터 출력
// ═════════════════════════════════════════════════════════════════════

void setMotorRTP(uint8_t tcaCh, uint8_t amplitude) {
    tcaSelect(tcaCh);
    drv_write(REG_RTP, amplitude);
}

void stopAllMotors() {
    setMotorRTP(CH_LEFT, 0);
    setMotorRTP(CH_RIGHT, 0);
}

// ═════════════════════════════════════════════════════════════════════
// 체크섬 검증
// ═════════════════════════════════════════════════════════════════════

bool verifyChecksum(const uint8_t* data) {
    uint16_t sum = 0;
    for (int i = 0; i < 14; i++) sum += data[i];
    uint16_t stored = data[14] | (data[15] << 8);
    return (data[0] == HEADER_0 && data[1] == HEADER_1 && (sum & 0xFFFF) == stored);
}

// ═════════════════════════════════════════════════════════════════════
// AA 55 자동 정렬
// ═════════════════════════════════════════════════════════════════════

uint16_t findFrameStart(const uint8_t* data, size_t len) {
    size_t searchLimit = (len < PKT_SIZE * 2) ? len : PKT_SIZE * 2;
    for (size_t off = 0; off + 1 < searchLimit; off++) {
        if (data[off] == HEADER_0 && data[off + 1] == HEADER_1) {
            size_t next = off + PKT_SIZE;
            if (next + 1 < len) {
                if (data[next] == HEADER_0 && data[next + 1] == HEADER_1)
                    return off;
            } else {
                return off;
            }
        }
    }
    return 0;
}

// ═════════════════════════════════════════════════════════════════════
// 재생 틱
// ═════════════════════════════════════════════════════════════════════

void playbackTick() {
    if (playState != ST_PLAYING) return;

    if (playIndex >= frameCount) {
        playState = ST_STOPPED;
        stopAllMotors();
        Serial.printf("[PLAY] Done. %u frames, %u cksum warns, i2c_err=%u\n",
                      framesPlayed, cksumWarns, i2cErrors);
        if (isConnected) webSocket.sendTXT("PLAY_DONE");
        return;
    }

    uint8_t* frame = dataBuf + (playIndex * PKT_SIZE);

    uint16_t dur = frame[12] | (frame[13] << 8);
    if (dur < 20)   dur = 20;
    if (dur > 1000) dur = 1000;

    unsigned long now = millis();
    if (now - lastFrameTime < dur) return;
    lastFrameTime = now;

    // 헤더 검증
    if (frame[0] != HEADER_0 || frame[1] != HEADER_1) {
        playIndex++;
        return;
    }

    if (!verifyChecksum(frame)) {
        cksumWarns++;
    }

    uint8_t intL = frame[10];
    uint8_t intR = frame[11];

    setMotorRTP(CH_LEFT,  intL >> 1);
    setMotorRTP(CH_RIGHT, intR >> 1);

    if (framesPlayed % 10 == 0) {
        uint32_t ts = frame[3] | (frame[4] << 8) | (frame[5] << 16) | (frame[6] << 24);
        Serial.printf("[PLAY] #%4d | ts=%5ums | L=%3d R=%3d | dur=%dms\n",
                      playIndex, ts, intL, intR, dur);
    }

    framesPlayed++;
    playIndex++;
}

// ═════════════════════════════════════════════════════════════════════
// 누적 데이터 확정
// ═════════════════════════════════════════════════════════════════════

void finalizeData() {
    accumulating = false;

    if (accumLen == 0) return;

    Serial.printf("[ACCUM] Finalize: %u bytes\n", accumLen);

    // AA 55 자동 정렬
    uint16_t alignOff = findFrameStart(dataBuf, accumLen);
    if (alignOff > 0) {
        memmove(dataBuf, dataBuf + alignOff, accumLen - alignOff);
        accumLen -= alignOff;
        Serial.printf("[DATA] Align: skip %d bytes\n", alignOff);
    }

    uint16_t numFrames = accumLen / PKT_SIZE;
    if (numFrames > MAX_FRAMES) numFrames = MAX_FRAMES;

    playState = ST_STOPPED;
    stopAllMotors();

    frameCount = numFrames;
    dataReady = true;
    playIndex = 0;
    framesPlayed = 0;
    cksumWarns = 0;

    // 첫 5프레임 검증
    int checkN = (numFrames < 5) ? numFrames : 5;
    int validN = 0;
    for (int i = 0; i < checkN; i++) {
        if (verifyChecksum(dataBuf + i * PKT_SIZE)) validN++;
    }

    Serial.printf("[DATA] %d frames, cksum %d/%d OK, heap=%d\n",
                  numFrames, validN, checkN, ESP.getFreeHeap());

    if (isConnected) {
        char resp[32];
        snprintf(resp, sizeof(resp), "DATA_OK:%d", numFrames);
        webSocket.sendTXT(resp);
    }
}

// ═════════════════════════════════════════════════════════════════════
// PLAY / STOP 핸들러
// ═════════════════════════════════════════════════════════════════════

void handleCmdPlay(uint8_t* payload) {
    if (accumulating) finalizeData();

    uint16_t startIdx = ((uint16_t)payload[1] << 8) | payload[2];

    if (!dataReady || frameCount == 0) {
        if (isConnected) webSocket.sendTXT("ERR:NO_DATA");
        return;
    }
    if (startIdx >= frameCount) {
        if (isConnected) webSocket.sendTXT("ERR:BAD_INDEX");
        return;
    }

    playIndex = startIdx;
    playState = ST_PLAYING;
    framesPlayed = 0;
    cksumWarns = 0;
    lastFrameTime = millis();

    Serial.printf("[CMD] PLAY from %d / %d frames\n", startIdx, frameCount);
    if (isConnected) webSocket.sendTXT("PLAYING");
}

void handleCmdPause() {
    playState = ST_STOPPED;
    stopAllMotors();
    playIndex = 0;
    framesPlayed = 0;
    cksumWarns = 0;
    accumulating = false;
    accumLen = 0;

    Serial.println("[CMD] STOP");
    if (isConnected) webSocket.sendTXT("STOPPED");
}

// ═════════════════════════════════════════════════════════════════════
// WebSocket 이벤트 (Client 버전)
// ═════════════════════════════════════════════════════════════════════

void onWebSocketEvent(WStype_t type, uint8_t* payload, size_t length) {
    switch (type) {

        case WStype_CONNECTED:
            Serial.println("[WS] 릴레이 서버 연결 성공!");
            isConnected = true;
            break;

        case WStype_DISCONNECTED:
            Serial.println("[WS] 서버 연결 끊김!");
            isConnected = false;
            playState = ST_STOPPED;
            stopAllMotors();
            accumulating = false;
            accumLen = 0;
            break;

        case WStype_BIN:
            // [0x02] → STOP
            if (length == 1 && payload[0] == CMD_PAUSE) {
                handleCmdPause();
                break;
            }

            // [0x01, idxHi, idxLo] → PLAY
            if (length == 3 && payload[0] == CMD_PLAY) {
                handleCmdPlay(payload);
                break;
            }

            // [0xFF, 0xFF, ...] → 데이터 첫 청크
            if (length >= 2 && payload[0] == CMD_DATA_0
                            && payload[1] == CMD_DATA_1) {
                accumLen = 0;
                accumulating = true;
                dataReady = false;
                frameCount = 0;
                lastChunkMs = millis();

                size_t dataLen = length - 2;
                size_t toWrite = (dataLen <= BUF_SIZE) ? dataLen : BUF_SIZE;
                memcpy(dataBuf, payload + 2, toWrite);
                accumLen = toWrite;

                Serial.printf("[ACCUM] Start: %u bytes\n", toWrite);
                break;
            }

            // 누적 중 → 이어지는 청크
            if (accumulating) {
                size_t space = BUF_SIZE - accumLen;
                size_t toWrite = (length <= space) ? length : space;
                memcpy(dataBuf + accumLen, payload, toWrite);
                accumLen += toWrite;
                lastChunkMs = millis();
                break;
            }

            Serial.printf("[BIN] Unknown: 0x%02X len=%u\n", payload[0], length);
            break;

        case WStype_TEXT:
            Serial.printf("[WS] TEXT: %s\n", (char*)payload);
            if (strcmp((char*)payload, "RESET") == 0) {
                playState = ST_STOPPED;
                stopAllMotors();
                frameCount = 0;
                dataReady = false;
                accumulating = false;
                accumLen = 0;
            }
            break;

        default:
            break;
    }
}

// ═════════════════════════════════════════════════════════════════════
// Setup
// ═════════════════════════════════════════════════════════════════════

void setup() {
    Serial.begin(115200);
    delay(500);

    Serial.println("\n╔══════════════════════════════════════╗");
    Serial.println("║  ESP32 Relay Haptic v3.3              ║");
    Serial.println("║  Dual VG1040003D 170Hz + Relay Client ║");
    Serial.println("╚══════════════════════════════════════╝");

    // I2C (400kHz)
    Wire.begin(SDA_PIN, SCL_PIN);
    Wire.setClock(400000);

    // DRV2605L 듀얼 모터 초기화
    initDRV2605(CH_LEFT);
    initDRV2605(CH_RIGHT);
    stopAllMotors();
    Serial.printf("[BOOT] i2c_err after init: %u\n", i2cErrors);

    // WiFi
    WiFi.begin(WIFI_SSID, WIFI_PASS);
    Serial.print("WiFi connecting");
    while (WiFi.status() != WL_CONNECTED) {
        delay(500);
        Serial.print(".");
    }
    Serial.printf("\nWiFi OK: %s\n", WiFi.localIP().toString().c_str());

    // 고정 버퍼 할당 (1회)
    dataBuf = (uint8_t*)malloc(BUF_SIZE);
    if (!dataBuf) {
        Serial.println("[FATAL] dataBuf malloc failed!");
        while (1) delay(1000);
    }
    Serial.printf("[MEM] dataBuf %u bytes OK\n", BUF_SIZE);

    // ★ WebSocket Client → 릴레이 서버 접속
    webSocket.begin(WS_HOST, WS_PORT, WS_PATH);
    webSocket.setExtraHeaders("Origin: https://j14e203.p.ssafy.io");
    webSocket.onEvent(onWebSocketEvent);
    webSocket.setReconnectInterval(5000);

    Serial.printf("[WS] Connecting to %s:%d%s\n", WS_HOST, WS_PORT, WS_PATH);
    Serial.printf("[BOOT] Heap: %d\n\n", ESP.getFreeHeap());
}

// ═════════════════════════════════════════════════════════════════════
// Loop
// ═════════════════════════════════════════════════════════════════════

void loop() {
    webSocket.loop();
    playbackTick();

    // 청크 타임아웃: 500ms 추가 청크 없으면 자동 확정
    if (accumulating && accumLen > 0 && (millis() - lastChunkMs > 500)) {
        Serial.println("[ACCUM] Timeout → finalize");
        finalizeData();
    }

    // 10초 상태 출력
    static unsigned long lastStatus = 0;
    if (millis() - lastStatus >= 10000) {
        lastStatus = millis();
        const char* st[] = {"STOP", "PLAY"};
        Serial.printf("[ST] %s | %d/%d | played=%u | i2c_err=%u | ws=%s | heap=%d\n",
                      st[playState], playIndex, frameCount,
                      framesPlayed, i2cErrors,
                      isConnected ? "ON" : "OFF",
                      ESP.getFreeHeap());
    }

    static unsigned long lastPing = 0;
if (isConnected && millis() - lastPing >= 30000) {
    lastPing = millis();
    webSocket.sendTXT("PING");
}
}
