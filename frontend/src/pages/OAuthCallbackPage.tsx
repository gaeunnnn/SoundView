// 카카오 OAuth 로그인 후 리다이렉트되는 콜백 페이지
import { useEffect } from "react";

export default function OAuthCallbackPage() {
  useEffect(() => {
    window.location.replace(
      (import.meta.env.VITE_BASE_PATH ?? "") + "/main"
    );
  }, []);

  return null;
}
