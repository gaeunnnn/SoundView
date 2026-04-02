# 🎥 [SoundView] 포팅 매뉴얼 (Porting Manual)

## 1. 개발 환경 (Development Environment)

### 1.1. Front-End (React)
- **Runtime:** Node.js `v24.12.0`
- **Framework:** React `19.2.0`
- **Build Tool:** Vite `7.2.4`
- **Language:** TypeScript
- **Communication & Media:**
    - `axios`: `1.7.9` (HTTP Client)
    - `framer-motion`: `11.15.0` (UI Motion)
    - `lucide-react`: `0.469.0` (Icon set)
    - `WebSocket`: 브라우저 기본 API (WSS Secure 연동)
- **Styling:** `tailwindcss`: `4.1.18` (Vite 전용 플러그인 모드)
- **Deployment:** Nginx 기반 정적 서빙 (Docker Container)

### 1.2. Back-End (Spring Boot)
- **Framework:** Spring Boot `3.5.9`
- **Language:** Java JDK `17` (Docker Image: `eclipse-temurin:17-jdk-alpine`)
- **Build Tool:** Gradle `8.14.3`
- **Plugin:** Dependency Management `1.1.7`
- **Core Dependencies:**
    - `spring-boot-starter-web`, `data-jpa`, `data-redis`
    - `spring-boot-starter-security`, `spring-boot-starter-oauth2-client`
    - `amqp-client`: `5.21.0` (RabbitMQ 통신)
- **External Services:**
    - `aws-java-sdk-s3` / `cloudfront`: `1.12.x` (Signed URL 생성용)
    - `jjwt`: `0.12.3` (JWT 인증 처리)
    - `springdoc-openapi`: `2.3.0` (Swagger UI)

### 1.3. AI Engine & Infrastructure
- **AI Framework:** Python FastAPI (음성 분리 및 햅틱 데이터 생성)
- **Operating System:** Ubuntu `20.04 LTS` (AWS EC2)
- **Container:** Docker Engine / Docker Compose `v3.8`
- **Database:** MySQL `8.0.43`, Redis `Alpine`
- **Message Broker:** RabbitMQ `3-management`
- **Object Storage:** MinIO (Local) & AWS S3 (Remote)
- **CI/CD:** Jenkins `LTS` (Docker-in-Docker 구동)
- **Management:** Portainer `CE Latest`

---

## 2. 아키텍쳐 구성도
![아키텍처.png](assets/%EC%95%84%ED%82%A4%ED%85%8D%EC%B2%98.png)
*(SoundView: 영상 데이터 업로드 -> AI 분석 -> IoT 햅틱 스트리밍 통합 아키텍처)*

---

## 3. 인프라 구축

### 3.1. 네트워크 구성 (Docker Network)
서비스 간의 물리적 격리 및 보안을 위해 용도별 네트워크를 운영합니다.
```bash
docker network create app-network
docker network create dev-net
docker network create prod-net
```

### 3.2. 전체 서버 포트 점유 현황 (Actual Status)
AWS 보안 그룹(Security Group) 및 방화벽 설정 시 반드시 다음 포트를 허용해야 합니다.

| 서비스명 | Host Port | Protocol | 설명 |
| :--- | :--- | :--- | :--- |
| **Main Nginx** | **80, 443** | TCP | 서비스 관문 및 SSL 인증 |
| **Jenkins** | **8899** | TCP | CI/CD 서버 (Inner 8080) |
| **Portainer** | **9010** | TCP | 컨테이너 관리 (Inner 9000) |
| **RabbitMQ** | **5672, 15672** | TCP | AMQP 통신 및 관리 UI |
| **MySQL-Dev** | **13306** | TCP | 개발 DB (Inner 3306) |
| **MySQL-Prod** | **23306** | TCP | 운영 DB (Inner 3306) |
| **Redis-Dev** | **16379** | TCP | 개발 캐시 (Inner 6379) |
| **Redis-Prod** | **26379** | TCP | 운영 캐시 (Inner 6379) |
| **MinIO** | **9000, 9001** | TCP | 로컬 스토리지 API/Console |
| **Dev Backend** | **8081** | TCP | 개발용 API 서버 |
| **Dev Frontend** | **3000** | TCP | 개발용 웹 서버 |

### 3.3. 미들웨어 구축 (RabbitMQ & Database)
**📂 `docker-compose.infra.yml`**
```yaml
version: '3.8'
services:
  rabbitmq:
    image: rabbitmq:3-management
    container_name: rabbitmq
    ports:
      - "5672:5672"
      - "15672:15672"
    environment:
      - RABBITMQ_DEFAULT_USER=[USER]
      - RABBITMQ_DEFAULT_PASS=[PASS]
    networks:
      - dev-net
      - prod-net

  mysql-dev:
    image: mysql:8.0
    container_name: mysql-dev
    ports:
      - "13306:3306"
    environment:
      - MYSQL_ROOT_PASSWORD=[PASS]
    networks:
      - dev-net
```

### 3.4. Main Gateway (Nginx) 설정
IoT 기기(ESP32)의 **HTTP WebSocket(WS)** 연결과 브라우저의 **HTTPS(WSS)** 연결을 동시에 지원하는 이중화 설정을 사용합니다.

**📂 `/etc/nginx/conf.d/default.conf`**
```nginx
server {
    listen 80;
    server_name j14e203.p.ssafy.io;

    # 📡 [IoT WebSocket] 기기 직접 접속용 (Redirection 제외)
    location /dev/api/ws {
        proxy_pass http://172.26.11.10:8081/api/ws;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }

    location / { return 301 https://$host$request_uri; }
}

server {
    listen 443 ssl;
    server_name j14e203.p.ssafy.io;

    ssl_certificate /etc/letsencrypt/live/j14e203.p.ssafy.io/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/j14e203.p.ssafy.io/privkey.pem;

    # 📡 [WSS Relay] 브라우저(WSS) -> 백엔드(WS) 변환
    location /dev/api/ws {
        proxy_pass http://172.26.11.10:8081/api/ws;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header X-Forwarded-Proto https;
    }

    location /dev/api/ {
        proxy_pass http://172.26.11.10:8081/api/;
        proxy_set_header X-Forwarded-Proto https;
    }

    location /dev/ {
        proxy_pass http://172.26.11.10:3000/;
    }
}
```

---

## 4. CI/CD 파이프라인 (Jenkins & GitLab)

### 4.1. Jenkins Multibranch Pipeline 구성
- **Item Name:** `total-deploy-soundview`
- **Branch Sources:** GitLab Repository (`back-dev`, `front-dev`, `master`)
- **Triggers:** GitLab Webhook (Push Events)

### 4.2. 백엔드 배포 스크립트 (Jenkinsfile)
CloudFront 보안을 위해 **Private/Public Key를 압축(Flattening)**하여 컨테이너 환경변수로 주입하는 기술적 특이사항이 포함되어 있습니다.

```groovy
def deployBack(envType) {
    stage("백엔드 배포") {
        dir('backend') {
            withCredentials([
                file(credentialsId: 'CF_PRIV_KEY', variable: 'PRIV_KEY_FILE'),
                file(credentialsId: 'CF_PUB_KEY', variable: 'PUB_KEY_FILE')
            ]) {
                script {
                    // .env 파일 생성 및 일반 변수 입력
                    sh """
                    echo "DB_URL=jdbc:mysql://mysql-${envType}:3306/${envType}_db" > .env
                    echo "RABBITMQ_HOST=j14e203.p.ssafy.io" >> .env
                    echo "AWS_S3_BUCKET_NAME=sound-view-dev" >> .env
                    echo "CLOUDFRONT_DOMAIN=d1qay46wjfaflr.cloudfront.net" >> .env
                    echo "CLOUDFRONT_KEY_PAIR_ID=K1WRDQD5WT1SII" >> .env
                    """

                    // 키 파일을 '진짜 한 줄'로 압축해서 .env에 밀어넣기
                    sh """
                    PUB_FLAT=\$(cat \$PUB_KEY_FILE | tr -d '\\n' | tr -d '\\r')
                    echo "CLOUDFRONT_PUBLIC_KEY=\$PUB_FLAT" >> .env
                    PRIV_FLAT=\$(cat \$PRIV_KEY_FILE | tr -d '\\n' | tr -d '\\r')
                    echo "CLOUDFRONT_PRIVATE_KEY=\$PRIV_FLAT" >> .env
                    """
                
                    sh "docker build -t my-back-${envType} ."
                    sh "docker rm -f back-${envType} || true"
                    sh "docker run -d --name back-${envType} --network ${envType}-net -p ${port}:8080 my-back-${envType}"
                }
            }
        }
    }
}
```

### 4.3. 프론트엔드 배포 스크립트 (Dockerfile)
Vite 빌드 시 환경 변수를 주입하고 Nginx로 서빙합니다.

```dockerfile
FROM node:24.12.0-alpine AS build
WORKDIR /app
ARG VITE_API_BASE_URL
ARG VITE_BASE_PATH
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_BASE_PATH=$VITE_BASE_PATH

COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:stable-alpine
COPY --from=build /app/dist /usr/share/nginx/html
# Nginx conf 복사 시 try_files 설정 필수 (SPA 라우팅 대응)
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

---

## 5. 보안 및 시스템 연동 명세

### 5.1. AWS S3 & CloudFront 연동
- **Signed URL 정책**: 영상 조회 시 Backend에서 만료 시간이 포함된 Signed URL을 동적 생성하여 전달.
- **Key Pair**: Jenkins Credentials에 등록된 PEM 파일을 통해 실시간 서명 수행.

### 5.2. IoT 햅틱 데이터 스트리밍
- **흐름**: 브라우저(WSS) <-> Backend <-> IoT 기기(WS)
- **특징**: Nginx가 80포트에서 `/api/ws` 요청을 가로채어 HTTPS 리다이렉션을 거치지 않고 직접 백엔드로 전달함으로써 지연율(Latency) 최소화.

---

## 6. 유저 테스트 가이드
1. **카카오 로그인**: `j14e203.p.ssafy.io/dev` 접속 후 로그인 수행.
2. **영상 업로드**: 영상 파일 선택 후 AI 변환 대기 (RabbitMQ 큐 처리 확인).
3. **햅틱 체험**: ESP32 기기를 전원 연결하고 영상 재생 시 진동이 동기화되는지 확인.
4. **마이페이지**: 변환된 자막 및 햅틱 데이터의 저장 상태 확인.
