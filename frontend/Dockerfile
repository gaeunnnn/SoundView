# 1단계: 빌드
FROM node:24-alpine AS builder
WORKDIR /app

ARG VITE_BASE_PATH
ARG VITE_API_BASE_URL
ARG VITE_REDIRECT_URI

ENV VITE_BASE_PATH=$VITE_BASE_PATH
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_REDIRECT_URI=$VITE_REDIRECT_URI

COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# 2단계: 서빙
FROM nginx:stable-alpine
# 🔴 핵심: 빌드 결과물을 /dev 폴더 안에 넣습니다.
COPY --from=builder /app/dist /usr/share/nginx/html/dev
# 🔴 추가: 루트(/) 경로로 들어오는 요청도 처리할 수 있게 복사해둡니다.
RUN cp -r /usr/share/nginx/html/dev/* /usr/share/nginx/html/

COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
