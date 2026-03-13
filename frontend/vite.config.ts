import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // 현재 디렉토리(.env)에서 환경 변수를 로드합니다.
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [react(), tailwindcss()],
    // 🔴 Jenkins가 주입해준 VITE_BASE_PATH를 사용하고, 없으면 기본값 '/'
    base: env.VITE_BASE_PATH || "/",
  };
});