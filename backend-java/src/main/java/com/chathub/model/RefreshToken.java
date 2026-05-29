package com.chathub.model;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.index.Indexed;

import java.time.Instant;
import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Document(collection = "refresh_tokens")
@CompoundIndexes({
    @CompoundIndex(name = "rt_user_id", def = "{'userId': 1}"),
    @CompoundIndex(name = "rt_token_hash", def = "{'tokenHash': 1}", unique = true)
})
public class RefreshToken {

    @Id
    private String mongoId;

    @Builder.Default
    private String id = UUID.randomUUID().toString();

    private String userId;

    /** SHA-256 hash of the actual refresh token — never store raw token */
    private String tokenHash;

    @Builder.Default
    private String createdAt = Instant.now().toString();

    private String expiresAt;

    @Builder.Default
    private boolean revoked = false;

    /** IP address for audit logging */
    private String createdFromIp;
}
