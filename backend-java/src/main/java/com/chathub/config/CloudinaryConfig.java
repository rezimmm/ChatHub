package com.chathub.config;

import com.cloudinary.Cloudinary;
import com.cloudinary.utils.ObjectUtils;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class CloudinaryConfig {

    private final AppProperties appProperties;

    public CloudinaryConfig(AppProperties appProperties) {
        this.appProperties = appProperties;
    }

    @Bean
    public Cloudinary cloudinary() {
        AppProperties.CloudinaryProperties cloudinaryProps = appProperties.getCloudinary();
        if (cloudinaryProps.getCloudName() == null || cloudinaryProps.getCloudName().isBlank()) {
            return null; // FileService will fallback to local disk if this is null
        }
        return new Cloudinary(ObjectUtils.asMap(
            "cloud_name", cloudinaryProps.getCloudName(),
            "api_key", cloudinaryProps.getApiKey(),
            "api_secret", cloudinaryProps.getApiSecret()
        ));
    }
}
