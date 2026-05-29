package com.chathub.websocket;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.messaging.simp.SimpMessagingTemplate;
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
@RequiredArgsConstructor
public class WebSocketPublisher {

    private final RedisTemplate<String, Object> redisTemplate;
    private final SimpMessagingTemplate messagingTemplate;
    private final ObjectMapper objectMapper;

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
            // Fallback: deliver directly via STOMP if Redis fails
            deliverDirectly(channelId, payload);
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
            messagingTemplate.convertAndSendToUser(userId, "/queue/messages", payload);
        }
    }

    /**
     * Direct STOMP delivery without going through Redis.
     * Used as fallback and for same-instance delivery.
     */
    public void deliverDirectly(String channelId, Map<String, Object> payload) {
        messagingTemplate.convertAndSend("/topic/channel/" + channelId, payload);
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
            messagingTemplate.convertAndSend("/topic/presence", statusMsg);
        }
    }
}
