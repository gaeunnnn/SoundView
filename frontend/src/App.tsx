// 라우트 경로를 연결하는 앱 엔트리 파일
import { Navigate, Route, Routes } from "react-router-dom";
import LoginPage from "./pages/LoginPage";
import MainPage from "./pages/MainPage";
import ViewerPage from "./pages/ViewerPage";
import UploadPage from "./pages/UploadPage";
import SoundEditPage from "./pages/SoundEditPage";
import { UploadProvider } from "./context/UploadContext";
import UploadProgressPip from "./components/Upload/UploadProgressPip";

export default function App() {
  return (
    <UploadProvider>
      <Routes>
        <Route path="/" element={<MainPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/viewer" element={<ViewerPage />} />
        <Route path="/upload" element={<UploadPage />} />
        <Route path="/sound-edit" element={<SoundEditPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <UploadProgressPip />
    </UploadProvider>
  );
}
