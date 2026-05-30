package com.chathub.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.Arrays;
import java.util.List;

@Configuration
public class CorsConfig {

    private final AppProperties appProperties;

    public CorsConfig(AppProperties appProperties) {
        this.appProperties = appProperties;
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        List<String> rawOrigins = appProperties.getCors().getAllowedOrigins();
        List<String> resolvedOrigins = new java.util.ArrayList<>();
        if (rawOrigins != null) {
            for (String origin : rawOrigins) {
                if (origin.contains(",")) {
                    for (String part : origin.split(",")) {
                        resolvedOrigins.add(part.trim());
                    }
                } else {
                    resolvedOrigins.add(origin.trim());
                }
            }
        }
        System.out.println("====== ChatHub CORS Configuration ======");
        System.out.println("Allowed Origins: " + resolvedOrigins);
        System.out.println("========================================");
        config.setAllowedOrigins(resolvedOrigins);
        config.setAllowedMethods(Arrays.asList("GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"));
        config.setAllowedHeaders(List.of("*"));
        config.setAllowCredentials(true); // Required for HttpOnly cookie refresh tokens
        config.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }
}
