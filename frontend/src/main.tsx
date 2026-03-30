import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {/* 🌟 빌드 시 주입된 환경 변수에 따라 /dev 또는 / 등으로 자동 설정됩니다. */}
    <BrowserRouter basename={import.meta.env.VITE_BASE_PATH || "/"}>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
