// 사용자 정보 관련 API 함수를 모아두는 파일

import { apiClient } from "./client";

export type UserProfile = {
  id: number;
  userCode: string;
  nickname: string;
  profileImageUrl: string | null;
};

// GET /api/users/me — 로그인한 사용자의 프로필 정보 조회
export const getMyProfile = (): Promise<UserProfile> =>
  apiClient.get<UserProfile>("/api/users/me").then((res) => res.data);
