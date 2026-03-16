// 라우트 경로를 연결하는 앱 엔트리 파일
import { Navigate, Route, Routes } from "react-router-dom";
import LoginPage from "./pages/LoginPage";
import MainPage from "./pages/MainPage";
import ViewerPage from "./pages/ViewerPage";
import UploadPage from "./pages/UploadPage";
import EditPage from "./pages/EditPage";
import { UploadProvider } from "./context/UploadContext";
import { VideosProvider } from "./context/VideosContext";
import UploadProgressPip from "./components/Upload/UploadProgressPip";

export default function App() {
  return (
    <VideosProvider>
      <UploadProvider>
        <Routes>
          <Route path="/" element={<LoginPage />} />
          <Route path="/main" element={<MainPage />} />
          <Route path="/viewer" element={<ViewerPage />} />
          <Route path="/upload" element={<UploadPage />} />
          <Route path="/edit" element={<EditPage />} />
          
        </Routes>
        <UploadProgressPip />
      </UploadProvider>
    </VideosProvider>
  );
}
