# 1단계: 빌드
FROM node:24-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# 2단계: 서빙
FROM nginx:stable-alpine
# 🔴 EC2 Nginx가 /dev/를 떼고 전달하므로, 컨테이너 내부에 /dev 폴더를 만들 필요가 없습니다.
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
