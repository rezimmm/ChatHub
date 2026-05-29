package com.chathub.model;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Document(collection = "invite_links")
public class InviteLink {

    @Id
    private String mongoId;

    @Builder.Default
    private String id = UUID.randomUUID().toString();

    private String channelId;
    private String createdBy;

    @Builder.Default
    private String token = "";

    private String expiresAt;
    private Integer maxUses;

    @Builder.Default
    private int useCount = 0;

    @Builder.Default
    private boolean isActive = true;

    @Builder.Default
    private String createdAt = Instant.now().toString();
}
