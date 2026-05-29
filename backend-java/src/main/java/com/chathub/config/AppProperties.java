package com.chathub.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

import java.util.List;

@Data
@Configuration
@ConfigurationProperties(prefix = "")
public class AppProperties {

    private Jwt jwt = new Jwt();
    private Upload upload = new Upload();
    private Aws aws = new Aws();
    private Gemini gemini = new Gemini();
    private Cors cors = new Cors();
    private Ws ws = new Ws();

    @Data
    public static class Jwt {
        private String secret = "supersecret-change-in-production";
        private long accessTokenExpiryMinutes = 30;
        private long refreshTokenExpiryDays = 30;
    }

    @Data
    public static class Upload {
        private String dir = "./uploads";
        private long maxSizeBytes = 10485760L;
        private List<String> allowedMimeTypes = List.of(
            "image/jpeg", "image/png", "image/gif", "image/webp",
            "application/pdf", "text/plain", "application/zip",
            "video/mp4", "audio/mpeg"
        );
    }

    @Data
    public static class Aws {
        private S3 s3 = new S3();

        @Data
        public static class S3 {
            private String bucket = "";
            private String region = "us-east-1";
            private String accessKey = "";
            private String secretKey = "";
            private String cdnUrl = "";
        }
    }

    @Data
    public static class Gemini {
        private String apiKey = "";
        private String model = "gemini-2.0-flash";
        private String baseUrl = "https://generativelanguage.googleapis.com/v1beta";
    }

    @Data
    public static class Cors {
        private List<String> allowedOrigins = List.of("http://localhost:3000", "http://localhost:5173");
    }

    @Data
    public static class Ws {
        private RateLimit rateLimit = new RateLimit();

        @Data
        public static class RateLimit {
            private int maxMessages = 20;
            private int windowSeconds = 10;
        }
    }
}
