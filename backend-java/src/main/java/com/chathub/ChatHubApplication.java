package com.chathub;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.data.mongodb.repository.config.EnableMongoRepositories;
import org.springframework.scheduling.annotation.EnableAsync;

import com.chathub.config.AppProperties;

@SpringBootApplication
@EnableConfigurationProperties(AppProperties.class)
@EnableMongoRepositories
@EnableCaching
@EnableAsync
public class ChatHubApplication {
    public static void main(String[] args) {
        loadDotEnv();
        SpringApplication.run(ChatHubApplication.class, args);
    }

    private static void loadDotEnv() {
        try {
            java.io.File envFile = new java.io.File(".env");
            if (!envFile.exists()) {
                envFile = new java.io.File("../.env");
            }
            if (envFile.exists()) {
                java.nio.file.Files.lines(envFile.toPath())
                    .map(String::trim)
                    .filter(line -> !line.startsWith("#") && line.contains("="))
                    .forEach(line -> {
                        int equalIdx = line.indexOf('=');
                        String key = line.substring(0, equalIdx).trim();
                        String value = line.substring(equalIdx + 1).trim();
                        if (value.startsWith("\"") && value.endsWith("\"")) {
                            value = value.substring(1, value.length() - 1);
                        } else if (value.startsWith("'") && value.endsWith("'")) {
                            value = value.substring(1, value.length() - 1);
                        }
                        if (System.getProperty(key) == null && System.getenv(key) == null) {
                            System.setProperty(key, value);
                        }
                    });
                System.out.println("Successfully loaded environment variables from .env");
            }
        } catch (Exception e) {
            System.err.println("Could not load .env file: " + e.getMessage());
        }
    }
}
