package com.example.sound.global.util;

import com.example.sound.global.config.CloudFrontConfig;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import software.amazon.awssdk.services.cloudfront.CloudFrontUtilities;
import software.amazon.awssdk.services.cloudfront.model.CustomSignerRequest;

import java.net.URL;
import java.security.PrivateKey;
import java.time.Instant;
import java.time.temporal.ChronoUnit;

@Component
@RequiredArgsConstructor
public class CloudFrontSigner {

    private final CloudFrontConfig cloudFrontConfig;
    private final PrivateKey cloudFrontPrivateKey;

    private static final CloudFrontUtilities CLOUDFRONT_UTILITIES = CloudFrontUtilities.create();

    /**
     * 프라이빗 리소스에 대한 10분 만료 Signed URL 생성
     */
    public String generateSignedUrl(String s3Key) {
        if (s3Key == null) return null;

        String resourceUrl = "https://" + cloudFrontConfig.getDomain() + "/" + s3Key;
        Instant expiration = Instant.now().plus(10, ChronoUnit.MINUTES);

        CustomSignerRequest request = CustomSignerRequest.builder()
                .resourceUrl(resourceUrl)
                .privateKey(cloudFrontPrivateKey)
                .keyPairId(cloudFrontConfig.getKeyPairId())
                .expirationDate(expiration)
                .build();

        return CLOUDFRONT_UTILITIES.getSignedUrlWithCustomPolicy(request).url();
    }

    /**
     * 퍼블릭 리소스(썸네일 등)에 대한 일반 CloudFront URL 생성
     */
    public String generatePublicUrl(String s3Key) {
        if (s3Key == null) return null;
        return "https://" + cloudFrontConfig.getDomain() + "/" + s3Key;
    }
}
