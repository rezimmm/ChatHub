package com.chathub.dto;

import lombok.Data;
import jakarta.validation.constraints.NotBlank;

@Data
public class MessageCreateRequest {
    @NotBlank
    private String channelId;
    @NotBlank
    private String content;
    private String replyTo;
    private String threadId;
}
