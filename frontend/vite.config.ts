import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // 🔴 EC2 Nginx가 /dev/를 떼고 전달해주므로, 빌드 기준은 가장 단순한 "/"로 설정합니다.
  base: "/",
});
