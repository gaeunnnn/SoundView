package com.example.sound.domain.video.service;

import com.example.sound.domain.video.dto.VideoUploadCompleteRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.*;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.PresignedUploadPartRequest;
import software.amazon.awssdk.services.s3.presigner.model.UploadPartPresignRequest;

import java.time.Duration;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class S3UploadService {

    private final S3Client s3Client;
    private final S3Presigner s3Presigner;

    @Value("${spring.cloud.aws.s3.bucket}")
    private String bucket;

    /**
     * S3 멀티파트 업로드 완료 (병합)
     */
    public void completeMultipartUpload(String s3Key, String uploadId, List<VideoUploadCompleteRequest.PartETagRequest> parts) {
        List<CompletedPart> completedParts = parts.stream()
                .map(part -> {
                    String etag = part.getETag();
                    // 🌟 ETag가 쌍따옴표로 감싸져 있지 않으면 강제로 입힘 (S3 필수 규격)
                    if (!etag.startsWith("\"")) {
                        etag = "\"" + etag + "\"";
                    }
                    return CompletedPart.builder()
                            .partNumber(part.getPartNumber())
                            .eTag(etag)
                            .build();
                })
                .sorted((p1, p2) -> p1.partNumber() - p2.partNumber()) // 🌟 파트 번호순 정렬 필수
                .collect(Collectors.toList());

        CompletedMultipartUpload completedMultipartUpload = CompletedMultipartUpload.builder()
                .parts(completedParts)
                .build();

        CompleteMultipartUploadRequest completeMultipartUploadRequest = CompleteMultipartUploadRequest.builder()
                .bucket(bucket)
                .key(s3Key)
                .uploadId(uploadId)
                .multipartUpload(completedMultipartUpload)
                .build();

        s3Client.completeMultipartUpload(completeMultipartUploadRequest);
    }

    /**
     * S3 멀티파트 업로드 초기화 및 Upload ID 발급
     */
    public String initiateMultipartUpload(String s3Key) {
        CreateMultipartUploadRequest request = CreateMultipartUploadRequest.builder()
                .bucket(bucket)
                .key(s3Key)
                .build();

        CreateMultipartUploadResponse response = s3Client.createMultipartUpload(request);
        return response.uploadId();
    }

    /**
     * 각 파트별 Presigned URL 생성
     */
    public List<String> generatePresignedUrls(String s3Key, String uploadId, int partCount) {
        List<String> presignedUrls = new ArrayList<>();

        for (int i = 1; i <= partCount; i++) {
            UploadPartRequest uploadPartRequest = UploadPartRequest.builder()
                    .bucket(bucket)
                    .key(s3Key)
                    .uploadId(uploadId)
                    .partNumber(i)
                    .build();

            UploadPartPresignRequest presignRequest = UploadPartPresignRequest.builder()
                    .signatureDuration(Duration.ofMinutes(60)) // 티켓 유효 시간 60분
                    .uploadPartRequest(uploadPartRequest)
                    .build();

            PresignedUploadPartRequest presignedRequest = s3Presigner.presignUploadPart(presignRequest);
            presignedUrls.add(presignedRequest.url().toString());
        }

        return presignedUrls;
    }

    /**
     * 고유한 S3 객체 키 생성 (경로: videos/yyyy/MM/dd/UUID_fileName)
     */
    public String generateS3Key(String originalFileName) {
        String datePath = LocalDate.now().format(DateTimeFormatter.ofPattern("yyyy/MM/dd"));
        String uuid = UUID.randomUUID().toString();
        // 공백 및 특수문자 제거 (Sanitize)
        String sanitizedFileName = originalFileName.replaceAll("\\s+", "_");
        return String.format("videos/%s/%s_%s", datePath, uuid, sanitizedFileName);
    }
}
