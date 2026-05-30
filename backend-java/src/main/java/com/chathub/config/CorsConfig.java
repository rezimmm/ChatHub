package com.chathub.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

@Configuration
public class CorsConfig {

    private final AppProperties appProperties;

    public CorsConfig(AppProperties appProperties) {
        this.appProperties = appProperties;
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();

        // Resolve origins: split any comma-separated values from env vars
        Set<String> origins = new LinkedHashSet<>();
        List<String> rawOrigins = appProperties.getCors().getAllowedOrigins();
        if (rawOrigins != null) {
            for (String origin : rawOrigins) {
                if (origin.contains(",")) {
                    for (String part : origin.split(",")) {
                        String trimmed = part.trim();
                        if (!trimmed.isEmpty()) {
                            origins.add(trimmed);
                        }
                    }
                } else {
                    String trimmed = origin.trim();
                    if (!trimmed.isEmpty()) {
                        origins.add(trimmed);
                    }
                }
            }
        }

        // Always ensure production origin is included as a safety net
        origins.add("https://rezimmm.github.io");
        origins.add("http://localhost:3000");
        origins.add("http://localhost:5173");

        System.out.println("====== ChatHub CORS Configuration ======");
        System.out.println("Allowed Origins: " + origins);
        System.out.println("========================================");

        config.setAllowedOrigins(new ArrayList<>(origins));
        config.setAllowedMethods(Arrays.asList("GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"));
        config.setAllowedHeaders(List.of("*"));
        config.setExposedHeaders(List.of("Authorization", "Content-Type"));
        config.setAllowCredentials(true);
        config.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }
}
