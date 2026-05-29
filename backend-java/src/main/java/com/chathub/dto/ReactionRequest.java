package com.chathub.dto;

import lombok.Data;
import jakarta.validation.constraints.NotBlank;

@Data
public class ReactionRequest {
    @NotBlank
    private String emoji;
}
