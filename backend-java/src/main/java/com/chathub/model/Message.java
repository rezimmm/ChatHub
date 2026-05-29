package com.chathub.model;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
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
@Document(collection = "messages")
@CompoundIndexes({
    @CompoundIndex(name = "channel_timestamp", def = "{'channelId': 1, 'timestamp': -1}")
})
public class Message {

    @Id
    private String mongoId;

    @Builder.Default
    private String id = UUID.randomUUID().toString();

    private String channelId;
    private String userId;
    private String username;
    private String content;

    @Builder.Default
    private String timestamp = Instant.now().toString();

    @Builder.Default
    private String avatarColor = "#7c3aed";

    private String avatarUrl;

    @Builder.Default
    private boolean edited = false;

    private String editedAt;

    @Builder.Default
    private List<Reaction> reactions = new ArrayList<>();

    private String fileUrl;
    private String fileName;
    private String fileType;

    @Builder.Default
    private boolean pinned = false;

    private String replyTo;

    @Builder.Default
    private List<String> readBy = new ArrayList<>();

    private String threadId;

    @Builder.Default
    private int replyCount = 0;
}
