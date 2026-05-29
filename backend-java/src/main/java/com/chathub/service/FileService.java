package com.chathub.service;

import com.chathub.config.AppProperties;
import com.chathub.dto.FileUploadResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.tika.Tika;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class FileService {

    private final AppProperties appProperties;
    private final S3Client s3Client; // nullable — Spring injects null if bean returns null

    private static final Tika TIKA = new Tika();

    // ─── Upload ───────────────────────────────────────────────────────────────

    public FileUploadResponse upload(MultipartFile file) throws IOException {
        byte[] content = file.getBytes();

        // 1. Size check
        if (content.length > appProperties.getUpload().getMaxSizeBytes()) {
            throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE,
                "File too large. Maximum size is 10MB.");
        }

        // 2. MIME type detection from magic bytes (not the declared Content-Type)
        String detectedMime = TIKA.detect(content);
        if (!appProperties.getUpload().getAllowedMimeTypes().contains(detectedMime)) {
            throw new ResponseStatusException(HttpStatus.UNSUPPORTED_MEDIA_TYPE,
                "File type not allowed: " + detectedMime);
        }

        // 3. Build safe filename
        String fileId = UUID.randomUUID().toString();
        String originalName = sanitizeFilename(file.getOriginalFilename());
        String extension = getExtension(originalName);
        String storedName = fileId + (extension.isBlank() ? "" : "." + extension);

        // 4. Store — S3 if configured, local disk otherwise
        String fileUrl;
        if (s3Client != null && !appProperties.getAws().getS3().getBucket().isBlank()) {
            fileUrl = uploadToS3(content, storedName, detectedMime);
        } else {
            fileUrl = uploadToLocal(content, storedName);
        }

        return FileUploadResponse.builder()
            .fileUrl(fileUrl)
            .fileName(originalName)
            .fileType(detectedMime)
            .fileSize(content.length)
            .build();
    }

    // ─── S3 Upload ────────────────────────────────────────────────────────────

    private String uploadToS3(byte[] content, String storedName, String mimeType) {
        String bucket = appProperties.getAws().getS3().getBucket();
        String key = "uploads/" + storedName;

        s3Client.putObject(PutObjectRequest.builder()
            .bucket(bucket)
            .key(key)
            .contentType(mimeType)
            .contentLength((long) content.length)
            .build(), RequestBody.fromBytes(content));

        String cdnUrl = appProperties.getAws().getS3().getCdnUrl();
        if (cdnUrl != null && !cdnUrl.isBlank()) {
            return cdnUrl + "/" + key;
        }
        return "https://" + bucket + ".s3." + appProperties.getAws().getS3().getRegion() + ".amazonaws.com/" + key;
    }

    // ─── Local Upload ─────────────────────────────────────────────────────────

    private String uploadToLocal(byte[] content, String storedName) throws IOException {
        Path uploadDir = Paths.get(appProperties.getUpload().getDir());
        Files.createDirectories(uploadDir);

        Path filePath = uploadDir.resolve(storedName);
        Files.write(filePath, content);

        return "/uploads/" + storedName;
    }

    // ─── Internal ─────────────────────────────────────────────────────────────

    private String sanitizeFilename(String filename) {
        if (filename == null || filename.isBlank()) return "upload";
        // Strip path traversal and keep only safe chars
        return filename.replaceAll("[^a-zA-Z0-9._\\-]", "_");
    }

    private String getExtension(String filename) {
        if (filename == null || !filename.contains(".")) return "";
        return filename.substring(filename.lastIndexOf('.') + 1).toLowerCase();
    }
}
