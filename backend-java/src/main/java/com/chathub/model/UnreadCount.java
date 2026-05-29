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
import java.util.UUID;

/**
 * Separate collection for unread counts per user per channel.
 * Eliminates the O(n) embedded write problem in Channel document.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Document(collection = "unread_counts")
@CompoundIndexes({
    @CompoundIndex(name = "uc_user_channel", def = "{'userId': 1, 'channelId': 1}", unique = true),
    @CompoundIndex(name = "uc_user_id", def = "{'userId': 1}")
})
public class UnreadCount {

    @Id
    private String mongoId;

    private String userId;
    private String channelId;

    @Builder.Default
    private int count = 0;

    private String lastReadMessageId;

    @Builder.Default
    private String updatedAt = Instant.now().toString();
}
