// ESP32 진동 프레임 테스트 컴포넌트 — 프레임 생성/hex 확인/다운로드/전송

import { useState } from "react";
import type { VibrationFrameInput } from "../../types/vibration";
import { buildVibrationBinary, downloadVibrationBinary, FRAME_SIZE } from "../../utils/vibrationFrame";
import { debugFrames, formatDebugInfo, explainChecksum, verifyAllChecksums } from "../../utils/vibrationDebug";
import { buildVibrationFrame } from "../../utils/vibrationFrame";
import { sendVibrationToESP32 } from "../../services/vibrationWebSocket";
import type { SendResult } from "../../services/vibrationWebSocket";

// 샘플 프레임 데이터
const SAMPLE_FRAMES: VibrationFrameInput[] = [
  { seq: 1, timestampMs: 0,   soundClass: 1, vibType: 1, frequency: 120, intensityL: 80,  intensityR: 80,  durationMs: 100 },
  { seq: 2, timestampMs: 100, soundClass: 1, vibType: 2, frequency: 100, intensityL: 60,  intensityR: 70,  durationMs: 120 },
  { seq: 3, timestampMs: 220, soundClass: 2, vibType: 1, frequency: 90,  intensityL: 50,  intensityR: 40,  durationMs: 150 },
  { seq: 4, timestampMs: 370, soundClass: 2, vibType: 3, frequency: 80,  intensityL: 100, intensityR: 100, durationMs: 200 },
  { seq: 5, timestampMs: 570, soundClass: 3, vibType: 2, frequency: 60,  intensityL: 30,  intensityR: 20,  durationMs: 80  },
];

const DEFAULT_WS_URL = "ws://10.134.85.88:81";

type DebugRow = ReturnType<typeof debugFrames>[number];

export default function VibrationFrameTester() {
  const [wsUrl, setWsUrl] = useState(DEFAULT_WS_URL);
  const [frames] = useState<VibrationFrameInput[]>(SAMPLE_FRAMES);
  const [debugRows, setDebugRows] = useState<DebugRow[]>([]);
  const [sendResult, setSendResult] = useState<SendResult | null>(null);
  const [sending, setSending] = useState(false);
  const [checksumDetail, setChecksumDetail] = useState<string>("");
  const [verifyLog, setVerifyLog] = useState<string>("");

  const handleGenerate = () => {
    const rows = debugFrames(frames);
    setDebugRows(rows);
    setChecksumDetail("");
    setVerifyLog("");
  };

  const handleChecksumDetail = (frameIndex: number) => {
    const frame = buildVibrationFrame(frames[frameIndex]);
    setChecksumDetail(explainChecksum(frame));
  };

  const handleVerifyAll = () => {
    const binary = buildVibrationBinary(frames);
    const results = verifyAllChecksums(binary);
    const lines = results.map(
      (r) => `Frame #${r.frameIndex}: ${r.match ? "OK" : "MISMATCH"}`
    );
    setVerifyLog(lines.join("\n"));
  };

  const handleDownload = () => {
    downloadVibrationBinary(frames, "vibration_test.bin");
  };

  const handleSend = async () => {
    setSending(true);
    setSendResult(null);
    try {
      const result = await sendVibrationToESP32(wsUrl, frames);
      setSendResult(result);
    } finally {
      setSending(false);
    }
  };

  const displayRows = debugRows.slice(0, 5);

  return (
    <div style={{ fontFamily: "monospace", padding: "24px", maxWidth: "900px" }}>
      <h2 style={{ marginBottom: "16px" }}>Vibration Frame Tester</h2>

      {/* ESP32 URL */}
      <div style={{ marginBottom: "12px" }}>
        <label style={{ display: "block", marginBottom: "4px", fontSize: "13px" }}>
          ESP32 WebSocket URL
        </label>
        <input
          value={wsUrl}
          onChange={(e) => setWsUrl(e.target.value)}
          style={{ width: "320px", padding: "6px 8px", fontFamily: "monospace", fontSize: "13px" }}
          placeholder="ws://192.168.x.x:81"
        />
      </div>

      {/* 버튼 그룹 */}
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "20px" }}>
        <button onClick={handleGenerate} style={btnStyle("#3B82F6")}>
          샘플 프레임 생성 ({frames.length}개)
        </button>
        <button onClick={handleVerifyAll} style={btnStyle("#10B981")}>
          전체 체크섬 검증
        </button>
        <button onClick={handleDownload} style={btnStyle("#8B5CF6")}>
          .bin 다운로드
        </button>
        <button
          onClick={handleSend}
          disabled={sending}
          style={btnStyle(sending ? "#6B7280" : "#EF4444")}
        >
          {sending ? "전송 중..." : "ESP32로 전송"}
        </button>
      </div>

      {/* 프레임 hex 출력 (최대 5개) */}
      {displayRows.length > 0 && (
        <section style={{ marginBottom: "20px" }}>
          <h3 style={{ fontSize: "14px", marginBottom: "8px" }}>
            프레임 hex 출력 (상위 {displayRows.length}개 / {frames.length}개)
          </h3>
          {displayRows.map((row) => (
            <div
              key={row.frameIndex}
              style={{
                background: "#0F172A",
                color: "#E2E8F0",
                borderRadius: "6px",
                padding: "10px 12px",
                marginBottom: "8px",
                fontSize: "12px",
                lineHeight: "1.7",
              }}
            >
              <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>
                {formatDebugInfo(row)}
              </pre>
              <button
                onClick={() => handleChecksumDetail(row.frameIndex)}
                style={{
                  marginTop: "6px",
                  fontSize: "11px",
                  padding: "2px 8px",
                  background: "#1E293B",
                  color: "#94A3B8",
                  border: "1px solid #334155",
                  borderRadius: "4px",
                  cursor: "pointer",
                }}
              >
                체크섬 계산 과정 보기
              </button>
            </div>
          ))}
        </section>
      )}

      {/* 체크섬 상세 */}
      {checksumDetail && (
        <section style={{ marginBottom: "20px" }}>
          <h3 style={{ fontSize: "14px", marginBottom: "8px" }}>체크섬 계산 상세</h3>
          <pre
            style={{
              background: "#0F172A",
              color: "#FCD34D",
              padding: "10px 12px",
              borderRadius: "6px",
              fontSize: "12px",
              margin: 0,
              whiteSpace: "pre-wrap",
            }}
          >
            {checksumDetail}
          </pre>
        </section>
      )}

      {/* 전체 체크섬 검증 결과 */}
      {verifyLog && (
        <section style={{ marginBottom: "20px" }}>
          <h3 style={{ fontSize: "14px", marginBottom: "8px" }}>전체 체크섬 검증</h3>
          <pre
            style={{
              background: "#0F172A",
              color: "#6EE7B7",
              padding: "10px 12px",
              borderRadius: "6px",
              fontSize: "12px",
              margin: 0,
              whiteSpace: "pre-wrap",
            }}
          >
            {verifyLog}
          </pre>
        </section>
      )}

      {/* 전송 결과 */}
      {sendResult && (
        <section style={{ marginBottom: "20px" }}>
          <h3 style={{ fontSize: "14px", marginBottom: "8px" }}>전송 결과</h3>
          <div
            style={{
              background: "#0F172A",
              color: sendResult.ok ? "#6EE7B7" : "#FCA5A5",
              padding: "10px 12px",
              borderRadius: "6px",
              fontSize: "12px",
            }}
          >
            <div>status : {sendResult.ok ? "OK" : "FAILED"}</div>
            <div>bytes  : {sendResult.bytesSent} bytes ({sendResult.bytesSent / FRAME_SIZE} frames)</div>
            {sendResult.error && <div>error  : {sendResult.error}</div>}
            {sendResult.ackMessages.length > 0 && (
              <div style={{ marginTop: "6px" }}>
                <div style={{ color: "#94A3B8", marginBottom: "2px" }}>ESP ack:</div>
                {sendResult.ackMessages.map((m, i) => (
                  <div key={i} style={{ paddingLeft: "12px" }}>{m}</div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* 바이트 레이아웃 참고표 */}
      <section>
        <h3 style={{ fontSize: "14px", marginBottom: "8px" }}>16-byte 프레임 레이아웃</h3>
        <table style={{ fontSize: "12px", borderCollapse: "collapse", width: "100%" }}>
          <thead>
            <tr style={{ background: "#1E293B", color: "#CBD5E1" }}>
              {["offset", "bytes", "type", "field", "value range"].map((h) => (
                <th key={h} style={{ padding: "4px 10px", textAlign: "left", border: "1px solid #334155" }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {LAYOUT_ROWS.map((row) => (
              <tr key={row[0]} style={{ color: "#E2E8F0" }}>
                {row.map((cell, ci) => (
                  <td key={ci} style={{ padding: "3px 10px", border: "1px solid #1E293B" }}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function btnStyle(bg: string): React.CSSProperties {
  return {
    background: bg,
    color: "#fff",
    border: "none",
    borderRadius: "6px",
    padding: "8px 16px",
    cursor: "pointer",
    fontSize: "13px",
    fontFamily: "monospace",
  };
}

const LAYOUT_ROWS = [
  ["[0]",     "1", "fixed",      "header[0]",    "0xAA"],
  ["[1]",     "1", "fixed",      "header[1]",    "0x55"],
  ["[2]",     "1", "uint8",      "seq",           "0~255"],
  ["[3-6]",   "4", "uint32 LE",  "timestamp_ms",  "0~4294967295"],
  ["[7]",     "1", "uint8",      "sound_class",   "0~255"],
  ["[8]",     "1", "uint8",      "vib_type",      "0~255"],
  ["[9]",     "1", "uint8",      "frequency",     "0~255"],
  ["[10]",    "1", "uint8",      "intensity_L",   "0~255"],
  ["[11]",    "1", "uint8",      "intensity_R",   "0~255"],
  ["[12-13]", "2", "uint16 LE",  "duration_ms",   "0~65535"],
  ["[14-15]", "2", "uint16 LE",  "checksum",      "sum([0..13]) & 0xFFFF"],
];
