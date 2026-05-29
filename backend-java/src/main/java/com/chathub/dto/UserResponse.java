package com.chathub.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserResponse {
    private String id;
    private String email;
    private String username;
    private boolean isOnline;
    private String status;
    private String lastSeen;
    private String avatarColor;
    private String avatarUrl;
    private String bio;
    private String createdAt;

    public static UserResponse from(com.chathub.model.User user) {
        return UserResponse.builder()
            .id(user.getId())
            .email(user.getEmail())
            .username(user.getUsername())
            .isOnline(user.isOnline())
            .status(user.getStatus())
            .lastSeen(user.getLastSeen())
            .avatarColor(user.getAvatarColor())
            .avatarUrl(user.getAvatarUrl())
            .bio(user.getBio())
            .createdAt(user.getCreatedAt())
            .build();
    }
}
