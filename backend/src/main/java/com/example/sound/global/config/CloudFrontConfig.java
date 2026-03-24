package com.example.sound.global.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.security.KeyFactory;
import java.security.PrivateKey;
import java.security.spec.PKCS8EncodedKeySpec;
import java.util.Base64;

@Configuration
public class CloudFrontConfig {

    @Value("${spring.cloud.aws.cloudfront.key-pair-id}")
    private String keyPairId;

    @Value("${spring.cloud.aws.cloudfront.private-key}")
    private String privateKeyContent;

    @Value("${spring.cloud.aws.cloudfront.domain}")
    private String domain;

    @Bean
    public PrivateKey cloudFrontPrivateKey() throws Exception {
        // 1. 모든 노이즈 제거
        String cleanedKey = privateKeyContent
                .replace("-----BEGIN RSA PRIVATE KEY-----", "")
                .replace("-----END RSA PRIVATE KEY-----", "")
                .replace("-----BEGIN PRIVATE KEY-----", "")
                .replace("-----END PRIVATE KEY-----", "")
                .replace("\\n", "")  // 문자열 형태의 \n 제거
                .replace("\"", "")   // 🌟 양 끝 또는 내부의 쌍따옴표(") 제거
                .replaceAll("\\s", ""); // 모든 공백 및 실제 줄바꿈 제거

        // 2. 순수한 Base64 데이터만 남은 상태에서 디코딩
        byte[] keyBytes = Base64.getDecoder().decode(cleanedKey);

        // 3. PKCS#8 스펙으로 키 생성
        PKCS8EncodedKeySpec spec = new PKCS8EncodedKeySpec(keyBytes);
        KeyFactory kf = KeyFactory.getInstance("RSA");
        return kf.generatePrivate(spec);
    }

    public String getKeyPairId() {
        // ID에도 혹시 따옴표가 섞여 들어올 수 있으므로 제거
        return keyPairId.replace("\"", "").trim();
    }

    public String getDomain() {
        // 도메인에서도 따옴표 제거 및 끝 슬래시 정리
        String cleanedDomain = domain.replace("\"", "").trim();
        if (cleanedDomain.startsWith("https://")) {
            cleanedDomain = cleanedDomain.substring(8);
        } else if (cleanedDomain.startsWith("http://")) {
            cleanedDomain = cleanedDomain.substring(7);
        }
        return cleanedDomain.endsWith("/") ? cleanedDomain.substring(0, cleanedDomain.length() - 1) : cleanedDomain;
    }
}
