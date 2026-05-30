package com.chathub.websocket;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationContext;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import java.util.Map;

/**
 * Publishes messages to Redis pub/sub channel for cross-instance fan-out.
 * Pattern: chathub:channel:{channelId}
 *
 * All running instances subscribe to "chathub:*" via RedisConfig.
 * Each instance's RedisSubscriberService receives the message and
 * delivers it to locally connected WebSocket sessions.
 */
@Slf4j
@Service
public class WebSocketPublisher {

    private final RedisTemplate<String, Object> redisTemplate;
    private final ApplicationContext applicationContext;
    private final ObjectMapper objectMapper;

    public WebSocketPublisher(RedisTemplate<String, Object> redisTemplate,
                              ApplicationContext applicationContext,
                              ObjectMapper objectMapper) {
        this.redisTemplate = redisTemplate;
        this.applicationContext = applicationContext;
        this.objectMapper = objectMapper;
    }

    private ChatWebSocketHandler getChatWebSocketHandler() {
        return applicationContext.getBean(ChatWebSocketHandler.class);
    }

    /**
     * Publish a message to all subscribers of a channel.
     * The message flows: this method → Redis → all instances → WebSocket sessions.
     */
    public void publishToChannel(String channelId, Map<String, Object> payload) {
        String redisChannel = "chathub:channel:" + channelId;
        try {
            String json = objectMapper.writeValueAsString(payload);
            redisTemplate.convertAndSend(redisChannel, json);
        } catch (Exception e) {
            log.error("Failed to publish to Redis channel {}: {}", redisChannel, e.getMessage());
            // Fallback: deliver directly via WebSocket handler if Redis fails
            try {
                String json = objectMapper.writeValueAsString(payload);
                getChatWebSocketHandler().deliverToChannel(channelId, json);
            } catch (Exception ex) {
                log.error("Failed direct fallback delivery to channel {}: {}", channelId, ex.getMessage());
            }
        }
    }

    /**
     * Publish to a specific user's private queue.
     */
    public void publishToUser(String userId, Map<String, Object> payload) {
        String redisChannel = "chathub:user:" + userId;
        try {
            String json = objectMapper.writeValueAsString(payload);
            redisTemplate.convertAndSend(redisChannel, json);
        } catch (Exception e) {
            log.error("Failed to publish to user {}: {}", userId, e.getMessage());
            try {
                String json = objectMapper.writeValueAsString(payload);
                getChatWebSocketHandler().deliverToUser(userId, json);
            } catch (Exception ex) {
                log.error("Failed direct fallback delivery to user {}: {}", userId, ex.getMessage());
            }
        }
    }

    /**
     * Broadcast user status to all connected clients.
     */
    public void broadcastUserStatus(String userId, boolean isOnline, String status, String lastSeen) {
        Map<String, Object> statusMsg = Map.of(
            "type", "user_status",
            "user_id", userId,
            "is_online", isOnline,
            "status", status != null ? status : "online",
            "last_seen", lastSeen != null ? lastSeen : "",
            "timestamp", java.time.Instant.now().toString()
        );
        try {
            String json = objectMapper.writeValueAsString(statusMsg);
            redisTemplate.convertAndSend("chathub:broadcast", json);
        } catch (Exception e) {
            log.error("Failed to publish broadcast to Redis: {}", e.getMessage());
            try {
                String json = objectMapper.writeValueAsString(statusMsg);
                getChatWebSocketHandler().deliverToAll(json);
            } catch (Exception ex) {
                log.error("Failed direct fallback broadcast: {}", ex.getMessage());
            }
        }
    }
}
