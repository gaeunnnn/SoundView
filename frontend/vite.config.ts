import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // 🔴 공식 서브 경로 배포 방식: 빌드 기준을 "/dev/"로 설정합니다.
  base: "/dev/",
});
