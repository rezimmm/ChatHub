package com.chathub.model;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Document(collection = "users")
@CompoundIndexes({
    @CompoundIndex(name = "user_id_unique", def = "{'id': 1}", unique = true),
    @CompoundIndex(name = "user_email_unique", def = "{'email': 1}", unique = true)
})
public class User {

    @Id
    private String mongoId;

    @Builder.Default
    private String id = UUID.randomUUID().toString();

    @Indexed(unique = true)
    private String email;

    private String username;

    private String hashedPassword;

    @Builder.Default
    private boolean isOnline = false;

    @Builder.Default
    private String status = "online";

    @Builder.Default
    private String lastSeen = Instant.now().toString();

    @Builder.Default
    private String avatarColor = "#7c3aed";

    private String avatarUrl;

    @Builder.Default
    private String bio = "";

    @Builder.Default
    private String createdAt = Instant.now().toString();

    // Returns a safe (no-password) representation
    public User withoutPassword() {
        User safe = new User();
        safe.setMongoId(this.mongoId);
        safe.setId(this.id);
        safe.setEmail(this.email);
        safe.setUsername(this.username);
        safe.setOnline(this.isOnline);
        safe.setStatus(this.status);
        safe.setLastSeen(this.lastSeen);
        safe.setAvatarColor(this.avatarColor);
        safe.setAvatarUrl(this.avatarUrl);
        safe.setBio(this.bio);
        safe.setCreatedAt(this.createdAt);
        return safe;
    }
}
