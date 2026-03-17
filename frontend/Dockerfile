# 1단계: 빌드
FROM node:24-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

# 🌟 젠킨스에서 보낸 환경 변수를 빌드 시점에 주입합니다.
ARG VITE_BASE_PATH
ARG VITE_API_BASE_URL
ARG VITE_REDIRECT_URI

ENV VITE_BASE_PATH=$VITE_BASE_PATH
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_REDIRECT_URI=$VITE_REDIRECT_URI

RUN npm run build

# 2단계: 서빙
FROM nginx:stable-alpine
# 🔴 파일을 복잡한 폴더 구조 없이 루트에 바로 복사합니다.
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
