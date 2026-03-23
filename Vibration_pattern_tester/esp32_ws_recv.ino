/*
 * ESP32 WebSocket Server - Binary File Receiver
 * 진동 없이 파일 전송 테스트용
 * 
 * 라이브러리: WebSockets by Markus Sattler (v2.4+)
 */

#include <WiFi.h>
#include <WebSocketsServer.h>

// ─── WiFi 설정 (수정!) ─────────────────────────────────────
const char* WIFI_SSID = "Bam";
const char* WIFI_PASS = "11223344";

// ─── WebSocket ──────────────────────────────────────────────
WebSocketsServer ws = WebSocketsServer(81);

#define LED_PIN 2
#define MAX_SIZE (100 * 1024)  // 512KB

uint8_t* buffer = nullptr;
size_t totalReceived = 0;

void printWiFiInfo() {
  Serial.println("\n===== WIFI INFO =====");

  Serial.print("SSID: ");
  Serial.println(WiFi.SSID());

  Serial.print("IP Address: ");
  Serial.println(WiFi.localIP());

  Serial.print("Gateway: ");
  Serial.println(WiFi.gatewayIP());

  Serial.print("Subnet: ");
  Serial.println(WiFi.subnetMask());

  Serial.print("DNS: ");
  Serial.println(WiFi.dnsIP());

  Serial.print("MAC: ");
  Serial.println(WiFi.macAddress());

  Serial.print("RSSI (signal): ");
  Serial.print(WiFi.RSSI());
  Serial.println(" dBm");

  Serial.print("WebSocket URL: ws://");
  Serial.print(WiFi.localIP());
  Serial.println(":81");

  Serial.println("=====================\n");
}

void onWebSocketEvent(uint8_t num, WStype_t type, uint8_t* payload, size_t length) {
  switch (type) {

    case WStype_CONNECTED:
      Serial.printf("[WS] Client #%u connected from %s\n",
                    num, ws.remoteIP(num).toString().c_str());
      digitalWrite(LED_PIN, HIGH);
      ws.sendTXT(num, "{\"status\":\"connected\"}");
      break;

    case WStype_DISCONNECTED:
      Serial.printf("[WS] Client #%u disconnected\n", num);
      digitalWrite(LED_PIN, LOW);
      break;

    case WStype_BIN: {
      memcpy(buffer + totalReceived, payload, length);
      totalReceived += length;

      Serial.printf("[BIN] +%d bytes → total %d bytes\n", length, totalReceived);

      char ack[128];
      snprintf(ack, sizeof(ack),
        "{\"status\":\"received\",\"chunk\":%d,\"total\":%d}",
        length, totalReceived);
      ws.sendTXT(num, ack);
      break;
    }

    case WStype_TEXT: {
      String msg = String((char*)payload);
      Serial.printf("[TXT] %s\n", msg.c_str());

      if (msg == "DONE") {
        Serial.printf("\n=== 전송 완료: %d bytes ===\n", totalReceived);
        // 첫 30바이트 hex
        Serial.print("  HEX: ");
        for (int i = 0; i < 30 && i < (int)totalReceived; i++)
          Serial.printf("%02X ", buffer[i]);
        Serial.println();

        char resp[128];
        snprintf(resp, sizeof(resp),
          "{\"status\":\"done\",\"totalBytes\":%d}", totalReceived);
        ws.sendTXT(num, resp);
      }
      else if (msg == "RESET") {
        totalReceived = 0;
        ws.sendTXT(num, "{\"status\":\"reset\"}");
        Serial.println("[RESET] Buffer cleared");
      }
      break;
    }

    default: break;
  }
}

void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println("\n== ESP32 WS Binary Receiver ==");

  pinMode(LED_PIN, OUTPUT);

  buffer = (uint8_t*)malloc(MAX_SIZE);
  if (!buffer) {
    Serial.println("ERROR: malloc failed");
    while (1) delay(1000);
  }

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  WiFi.setSleep(false);
  Serial.print("WiFi");
  while (WiFi.status() != WL_CONNECTED) { delay(500); Serial.print("."); }
  Serial.printf(" OK!\nws://%s:81\n", WiFi.localIP().toString().c_str());
  printWiFiInfo();
  ws.begin();
  ws.onEvent(onWebSocketEvent);
  Serial.println("Ready\n");
}

void loop() {
  ws.loop();
}
