package com.chathub.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AiResponse {
    private String type;   // "summary" | "smart_replies" | "chat"
    private String summary;
    private List<String> suggestions;
    private String reply;
}
