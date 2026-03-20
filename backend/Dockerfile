# 1단계: 빌드 (무거운 JDK)
FROM eclipse-temurin:17-jdk-alpine AS builder
WORKDIR /app

# 라이브러리 캐싱
COPY gradlew .
COPY gradle gradle
COPY build.gradle .
COPY settings.gradle .
RUN chmod +x ./gradlew
RUN ./gradlew dependencies --no-daemon

# 소스코드 복사 및 빌드
COPY src src
RUN ./gradlew clean bootJar -x test --no-daemon

# 2단계: 실행 (가벼운 JRE)
FROM eclipse-temurin:17-jre-alpine
WORKDIR /app

# 빌드된 jar 파일 복사
COPY --from=builder /app/build/libs/*.jar app.jar

# ✨ 수정된 부분: 젠킨스가 런타임에 주입할 .env 파일 복사 (경로 수정)
COPY .env .env

# 실행 (스프링이 .env를 읽도록 강제)
ENTRYPOINT ["java", "-jar", "app.jar", "--spring.config.import=optional:file:.env"]