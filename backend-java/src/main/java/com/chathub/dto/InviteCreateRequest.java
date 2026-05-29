package com.chathub.dto;

import lombok.Data;

@Data
public class InviteCreateRequest {
    private Integer expiresInHours;
    private Integer maxUses;
}
