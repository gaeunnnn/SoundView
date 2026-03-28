package com.example.sound.domain.video.service;

import com.example.sound.domain.video.dto.VideoUploadCompleteRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.*;

import java.io.IOException;
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
     * 단일 파일을 S3에 직접 업로드 (통짜 업로드 방식)
     */
    public void uploadMultipartFile(MultipartFile file, String s3Key) {
        try {
            PutObjectRequest putObjectRequest = PutObjectRequest.builder()
                    .bucket(bucket)
                    .key(s3Key)
                    .contentType(file.getContentType())
                    .build();

            s3Client.putObject(putObjectRequest, RequestBody.fromInputStream(file.getInputStream(), file.getSize()));
        } catch (IOException e) {
            throw new RuntimeException("S3 업로드 중 오류 발생", e);
        }
    }

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
     * 단일 파일 업로드(PUT)를 위한 Presigned URL 생성
     */
    public String generatePresignedUrlForPut(String s3Key) {
        if (s3Key == null) return null;

        PutObjectRequest putObjectRequest = PutObjectRequest.builder()
                .bucket(bucket)
                .key(s3Key)
                .contentType("application/json") // JSON 파일 업로드 강제
                .build();

        software.amazon.awssdk.services.s3.presigner.model.PutObjectPresignRequest presignRequest = 
            software.amazon.awssdk.services.s3.presigner.model.PutObjectPresignRequest.builder()
                .signatureDuration(Duration.ofMinutes(10)) // 10분 유효
                .putObjectRequest(putObjectRequest)
                .build();

        return s3Presigner.presignPutObject(presignRequest).url().toString();
    }

    /**
     * 고유한 S3 객체 키 생성 (경로: videos/yyyy/MM/dd/UUID_fileName)
     */
    public String generateS3Key(String originalFileName) {
        String datePath = LocalDate.now().format(DateTimeFormatter.ofPattern("yyyy/MM/dd"));
        String uuid = UUID.randomUUID().toString();
        // 공백 및 특수문자 제거 (Sanitize)
        String sanitizedFileName = originalFileName.replaceAll("\\s+", "_");
        return String.format("private/videos/%s/%s_%s", datePath, uuid, sanitizedFileName);
    }

    /**
     * 비디오 S3 키를 기반으로 썸네일 S3 키 생성 (경로: public/thumbnails/yyyy/MM/dd/UUID_fileName.jpg)
     */
    public String generateThumbnailKey(String videoS3Key) {
        if (videoS3Key == null) return null;

        // "private/videos/" -> "public/thumbnails/" 변경
        String thumbnailKey = videoS3Key.replace("private/videos/", "public/thumbnails/");

        // 확장자 제거 후 .jpg 고정
        int lastDotIndex = thumbnailKey.lastIndexOf('.');
        if (lastDotIndex != -1) {
            thumbnailKey = thumbnailKey.substring(0, lastDotIndex);
        }
        return thumbnailKey + ".jpg";
    }
}
