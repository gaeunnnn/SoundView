// 백엔드에 일반 API 요청을 보낼 때 공통으로 사용할 axios 설정 파일

import axios from "axios";

const BASE_URL = import.meta.env.VITE_API_BASE_URL;

export const apiClient = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
});

// 401 응답 시 토큰 재발급 후 원래 요청 재시도
let isRefreshing = false;
let refreshSubscribers: (() => void)[] = [];

apiClient.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status !== 401 || original._retry) {
      return Promise.reject(error);
    }
    original._retry = true;

    if (isRefreshing) {
      return new Promise((resolve) => {
        refreshSubscribers.push(() => resolve(apiClient(original)));
      });
    }

    isRefreshing = true;
    try {
      await apiClient.post("/api/auth/reissue");
      refreshSubscribers.forEach((cb) => cb());
      refreshSubscribers = [];
      return apiClient(original);
    } catch {
      refreshSubscribers = [];
      window.location.href = "/";
      return Promise.reject(error);
    } finally {
      isRefreshing = false;
    }
  }
);