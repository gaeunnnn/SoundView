// 로그인/로그아웃 등 인증 관련 API 함수를 모아두는 파일

import { apiClient } from "./client";

// 🌟 API 주소에서 /api를 제외한 베이스 주소를 추출하여 OAuth 경로를 만듭니다.
const AUTH_URL = import.meta.env.VITE_API_BASE_URL?.replace("/api", "") || "";
const REDIRECT_URI = import.meta.env.VITE_REDIRECT_URI || "";

// GET /oauth2/authorization/kakao — 카카오 OAuth 로그인 페이지로 리다이렉트
export const kakaoLogin = (): void => {
  window.location.href = `${AUTH_URL}/oauth2/authorization/kakao?redirect_uri=${REDIRECT_URI}`;
};

// POST /api/auth/reissue — refresh token으로 access token · refresh token 재발급
export const reissueToken = (): Promise<{ message: string }> =>
  apiClient.post<{ message: string }>("/api/auth/reissue").then((res) => res.data);

// POST /api/auth/logout — 로그아웃 (Redis에서 refresh token 삭제 및 토큰 쿠키 제거)
export const logout = (): Promise<{ message: string }> =>
  apiClient.post<{ message: string }>("/api/auth/logout").then((res) => res.data);