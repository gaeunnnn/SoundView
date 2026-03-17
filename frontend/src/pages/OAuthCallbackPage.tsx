// 카카오 OAuth 로그인 후 리다이렉트되는 콜백 페이지
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function OAuthCallbackPage() {
  const navigate = useNavigate();

  useEffect(() => {
    navigate("/main", { replace: true });
  }, [navigate]);

  return null;
}
