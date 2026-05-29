package com.chathub.config;

import com.chathub.security.JwtUtil;
import com.chathub.security.UserDetailsServiceImpl;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.index.IndexOperations;
import org.springframework.data.mongodb.core.index.MongoPersistentEntityIndexResolver;
import org.springframework.data.mongodb.core.mapping.MongoMappingContext;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

import com.chathub.model.*;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@Component
@RequiredArgsConstructor
public class MongoConfig {

    private final MongoTemplate mongoTemplate;
    private final MongoMappingContext mongoMappingContext;

    @EventListener(ApplicationReadyEvent.class)
    public void ensureIndexes() {
        Class<?>[] indexedEntities = {
            User.class, Channel.class, Message.class,
            InviteLink.class, RefreshToken.class, UnreadCount.class
        };

        MongoPersistentEntityIndexResolver resolver =
            new MongoPersistentEntityIndexResolver(mongoMappingContext);

        for (Class<?> entity : indexedEntities) {
            try {
                IndexOperations indexOps = mongoTemplate.indexOps(entity);
                resolver.resolveIndexFor(entity).forEach(indexOps::ensureIndex);
                log.info("Indexes ensured for {}", entity.getSimpleName());
            } catch (Exception e) {
                log.warn("Could not ensure indexes for {}: {}", entity.getSimpleName(), e.getMessage());
            }
        }

        // Create text index for message search
        try {
            mongoTemplate.getDb().getCollection("messages")
                .createIndex(new org.bson.Document("content", "text"));
            log.info("Text index created for messages.content");
        } catch (Exception e) {
            log.warn("Text index creation: {}", e.getMessage());
        }
    }
}
