package com.chathub.dto;

import lombok.Data;
import jakarta.validation.constraints.NotBlank;

@Data
public class MessageUpdateRequest {
    @NotBlank
    private String content;
}
