package com.chathub.config;

import com.chathub.config.AppProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;

@Configuration
public class S3Config {

    private final AppProperties appProperties;

    public S3Config(AppProperties appProperties) {
        this.appProperties = appProperties;
    }

    @Bean
    public S3Client s3Client() {
        AppProperties.Aws.S3 s3Props = appProperties.getAws().getS3();

        // If no credentials configured, return a no-op client (local disk fallback)
        if (s3Props.getAccessKey() == null || s3Props.getAccessKey().isBlank()) {
            return null; // FileService checks for null and falls back to local
        }

        return S3Client.builder()
            .region(Region.of(s3Props.getRegion()))
            .credentialsProvider(StaticCredentialsProvider.create(
                AwsBasicCredentials.create(s3Props.getAccessKey(), s3Props.getSecretKey())
            ))
            .build();
    }

    @Bean
    public S3Presigner s3Presigner() {
        AppProperties.Aws.S3 s3Props = appProperties.getAws().getS3();

        if (s3Props.getAccessKey() == null || s3Props.getAccessKey().isBlank()) {
            return null;
        }

        return S3Presigner.builder()
            .region(Region.of(s3Props.getRegion()))
            .credentialsProvider(StaticCredentialsProvider.create(
                AwsBasicCredentials.create(s3Props.getAccessKey(), s3Props.getSecretKey())
            ))
            .build();
    }
}
