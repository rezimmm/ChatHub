package com.chathub.dto;

import lombok.Data;
import jakarta.validation.constraints.NotBlank;
import java.util.List;

@Data
public class ChannelCreateRequest {
    @NotBlank
    private String name;
    private String description = "";
    @com.fasterxml.jackson.annotation.JsonProperty("is_dm")
    private boolean isDm = false;
    private List<String> members;
}
