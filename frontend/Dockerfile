# 1단계: 빌드
FROM node:24-alpine AS builder
WORKDIR /app

# 🔴 Jenkins에서 넘겨준 --build-arg를 받도록 선언
ARG VITE_BASE_PATH
ARG VITE_API_BASE_URL
ARG VITE_REDIRECT_URI

# 🔴 빌드 프로세스(npm run build)에서 사용할 수 있도록 환경 변수로 등록
ENV VITE_BASE_PATH=$VITE_BASE_PATH
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_REDIRECT_URI=$VITE_REDIRECT_URI

COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# 2단계: 서빙
FROM nginx:stable-alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
