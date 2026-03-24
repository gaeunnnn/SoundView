import Esp32WebSocketClient from "../components/Esp32/Esp32WebSocketClient";
import VibrationFrameTester from "../components/Esp32/VibrationFrameTester";

export default function TestPage() {
  return (
    <div>
      <Esp32WebSocketClient />
      <hr style={{ margin: "24px 0", borderColor: "#334155" }} />
      <VibrationFrameTester />
    </div>
  );
}
