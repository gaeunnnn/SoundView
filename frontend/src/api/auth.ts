// 로그인/로그아웃 등 인증 관련 API 함수를 모아두는 파일

const BASE_URL = import.meta.env.VITE_API_BASE_URL;
const REDIRECT_URI = import.meta.env.VITE_REDIRECT_URI;

export const kakaoLogin = (): void => {
  window.location.href = `${BASE_URL}/oauth2/authorization/kakao?redirect_uri=${REDIRECT_URI}`;
};