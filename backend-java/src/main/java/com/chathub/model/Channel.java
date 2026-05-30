package com.chathub.model;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.index.Indexed;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Document(collection = "channels")
public class Channel {

    @Id
    private String mongoId;

    @Builder.Default
    @Indexed(unique = true)
    private String id = UUID.randomUUID().toString();

    private String name;

    @Builder.Default
    private String description = "";

    @Builder.Default
    private boolean isDm = false;

    @Builder.Default
    private List<String> members = new ArrayList<>();

    private String createdBy;

    @Builder.Default
    private String createdAt = Instant.now().toString();

    @Builder.Default
    private List<String> isFavorite = new ArrayList<>();

    @Builder.Default
    private List<String> isMuted = new ArrayList<>();

    @Builder.Default
    private boolean isPrivate = false;

    private String password;

    // Note: unreadCount removed — now lives in unread_counts collection
}
