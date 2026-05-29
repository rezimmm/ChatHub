package com.chathub.dto;

import lombok.Data;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

@Data
public class AiRequest {
    /** Number of messages to include in context */
    private int limit = 20;

    /** For smart-reply: the message to generate replies for */
    private String messageId;

    /** Optional custom prompt for AI chat */
    private String prompt;
}
