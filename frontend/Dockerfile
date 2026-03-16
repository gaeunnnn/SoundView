# 1단계: 빌드
FROM node:24-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# 2단계: 서빙
FROM nginx:stable-alpine
# 🔴 빌드 결과물을 /dev 폴더 안에 넣습니다. (서브 경로 매칭)
COPY --from=builder /app/dist /usr/share/nginx/html/dev
# 🔴 루트로 들어오는 요청도 대비하여 복사해둡니다.
RUN cp -r /usr/share/nginx/html/dev/* /usr/share/nginx/html/

COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
