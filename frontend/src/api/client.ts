// 백엔드에 일반 API 요청을 보낼 때 공통으로 사용할 axios 설정 파일

import axios from "axios";

const BASE_URL = import.meta.env.VITE_API_BASE_URL;

export const apiClient = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
});

// 401 응답 시 로그인 페이지로 리다이렉트
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      window.location.replace(
        (import.meta.env.VITE_BASE_PATH ?? "") + "/"
      );
    }
    return Promise.reject(error);
  }
);
