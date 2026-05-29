package com.chathub.dto;

import lombok.Data;
import jakarta.validation.constraints.Size;

@Data
public class UserUpdateRequest {
    @Size(min = 2, max = 30)
    private String username;
    private String status;
    private String bio;
    private String avatarUrl;
}
