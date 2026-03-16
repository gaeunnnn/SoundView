// 로그인/로그아웃 등 인증 관련 API 함수를 모아두는 파일

import { apiClient } from "./client";

// 🔴 테스트를 위해 개발 서버 주소를 강제로 할당합니다. (나중에 환경변수로 복구 가능)
const BASE_URL = "https://j14e203.p.ssafy.io/dev/api";
const REDIRECT_URI = "https://j14e203.p.ssafy.io/dev/oauth";

// GET /oauth2/authorization/kakao — 카카오 OAuth 로그인 페이지로 리다이렉트
export const kakaoLogin = (): void => {
  window.location.href = `${BASE_URL}/oauth2/authorization/kakao?redirect_uri=${REDIRECT_URI}`;
};

// POST /api/auth/reissue — refresh token으로 access token · refresh token 재발급
export const reissueToken = (): Promise<{ message: string }> =>
  apiClient.post<{ message: string }>("/api/auth/reissue").then((res) => res.data);

// POST /api/auth/logout — 로그아웃 (Redis에서 refresh token 삭제 및 토큰 쿠키 제거)
export const logout = (): Promise<{ message: string }> =>
  apiClient.post<{ message: string }>("/api/auth/logout").then((res) => res.data);
