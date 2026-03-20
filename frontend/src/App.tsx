// 라우트 경로를 연결하는 앱 엔트리 파일
import { Route, Routes } from "react-router-dom";
import LoginPage from "./pages/LoginPage";
import LoginPage2 from "./pages/LoginPage2";
import MainPage from "./pages/MainPage";
import ViewerPage from "./pages/ViewerPage";
import UploadPage from "./pages/UploadPage";
import EditPage from "./pages/EditPage";
import OAuthCallbackPage from "./pages/OAuthCallbackPage";
import { UploadProvider } from "./context/UploadContext";
import { VideosProvider } from "./context/VideosContext";
import { UserProvider } from "./context/UserContext";
import UploadProgressPip from "./components/Upload/UploadProgressPip";

export default function App() {
  return (
    <UserProvider>
    <VideosProvider>
      <UploadProvider>
        <Routes>
          <Route path="/" element={<LoginPage />} />
          <Route path="/main" element={<MainPage />} />
          <Route path="/viewer" element={<ViewerPage />} />
          <Route path="/upload" element={<UploadPage />} />
          <Route path="/edit" element={<EditPage />} />
          <Route path="/oauth" element={<OAuthCallbackPage />} />
          <Route path="/login2" element={<LoginPage2 />} />
        </Routes>
        <UploadProgressPip />
      </UploadProvider>
    </VideosProvider>
    </UserProvider>
  );
}
