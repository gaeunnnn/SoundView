import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {/* 🔴 브라우저 주소창과 완벽하게 일치하도록 basename을 "/dev/"로 설정합니다. */}
    <BrowserRouter basename="/dev/">
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
