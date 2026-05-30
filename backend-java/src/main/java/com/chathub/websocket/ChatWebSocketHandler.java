package com.chathub.websocket;

import com.chathub.config.AppProperties;
import com.chathub.service.UserService;
import com.chathub.service.ChannelService;
import com.chathub.model.Channel;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.github.bucket4j.Bandwidth;
import io.github.bucket4j.Bucket;
import io.github.bucket4j.Refill;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.io.IOException;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

@Slf4j
@Component
public class ChatWebSocketHandler extends TextWebSocketHandler {

    private final WebSocketPublisher wsPublisher;
    private final UserService userService;
    private final ChannelService channelService;
    private final AppProperties appProperties;
    private final ObjectMapper objectMapper;

    // Track active sessions: userId -> session
    private final ConcurrentHashMap<String, WebSocketSession> activeSessions = new ConcurrentHashMap<>();
    
    // Rate limiter buckets per user (in-memory token bucket via Bucket4j)
    private final ConcurrentHashMap<String, Bucket> rateLimitBuckets = new ConcurrentHashMap<>();

    private final ScheduledExecutorService heartbeatScheduler = Executors.newSingleThreadScheduledExecutor();

    public ChatWebSocketHandler(WebSocketPublisher wsPublisher,
                                 UserService userService,
                                 ChannelService channelService,
                                 AppProperties appProperties,
                                 ObjectMapper objectMapper) {
        this.wsPublisher = wsPublisher;
        this.userService = userService;
        this.channelService = channelService;
        this.appProperties = appProperties;
        this.objectMapper = objectMapper;

        // Start ping heartbeat scheduler to prevent idle timeouts (every 30s)
        this.heartbeatScheduler.scheduleAtFixedRate(this::sendHeartbeats, 30, 30, TimeUnit.SECONDS);
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        String userId = getUserIdFromSession(session);
        if (userId != null) {
            // Close old session if exists
            WebSocketSession oldSession = activeSessions.put(userId, session);
            if (oldSession != null && oldSession.isOpen()) {
                try {
                    oldSession.close();
                } catch (IOException e) {
                    log.error("Error closing old session for user {}: {}", userId, e.getMessage());
                }
            }
            userService.setOnline(userId, true);
            wsPublisher.broadcastUserStatus(userId, true, "online", Instant.now().toString());
            log.info("User {} connected via raw WebSocket (session {})", userId, session.getId());
        } else {
            log.warn("Unknown user tried to connect to WebSocket, closing session {}", session.getId());
            session.close(CloseStatus.BAD_DATA);
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) throws Exception {
        String userId = getUserIdFromSession(session);
        if (userId != null) {
            WebSocketSession current = activeSessions.get(userId);
            if (current != null && current.getId().equals(session.getId())) {
                activeSessions.remove(userId);
                userService.setOnline(userId, false);
                wsPublisher.broadcastUserStatus(userId, false, "offline", Instant.now().toString());
                rateLimitBuckets.remove(userId);
                log.info("User {} disconnected (session {})", userId, session.getId());
            }
        }
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        String userId = getUserIdFromSession(session);
        if (userId == null) return;

        if (!isRateLimitAllowed(userId)) {
            log.warn("WS rate limit exceeded for user {}", userId);
            return;
        }

        try {
            String payloadStr = message.getPayload();
            Map<String, Object> data = objectMapper.readValue(payloadStr, Map.class);
            String type = (String) data.get("type");

            if ("pong".equals(type)) {
                // Heartbeat response, no action needed
                return;
            }

            if ("typing".equals(type)) {
                String channelId = (String) data.get("channel_id");
                if (channelId != null) {
                    wsPublisher.publishToChannel(channelId, Map.of(
                        "type", "typing",
                        "user_id", userId,
                        "username", data.getOrDefault("username", ""),
                        "channel_id", channelId,
                        "is_typing", data.getOrDefault("is_typing", false)
                    ));
                }
            }
        } catch (Exception e) {
            log.error("Error processing text message from user {}: {}", userId, e.getMessage());
        }
    }

    // ─── Direct Delivery Methods ─────────────────────────────────────────────

    public void deliverToUser(String userId, String jsonPayload) {
        WebSocketSession session = activeSessions.get(userId);
        if (session != null && session.isOpen()) {
            synchronized (session) {
                try {
                    session.sendMessage(new TextMessage(jsonPayload));
                } catch (Exception e) {
                    log.error("Failed to send message to user {}: {}", userId, e.getMessage());
                }
            }
        }
    }

    public void deliverToChannel(String channelId, String jsonPayload) {
        try {
            Channel channel = channelService.getChannelById(channelId);
            if (channel != null && channel.getMembers() != null) {
                for (String memberId : channel.getMembers()) {
                    deliverToUser(memberId, jsonPayload);
                }
            }
        } catch (Exception e) {
            log.error("Failed to deliver to channel {}: {}", channelId, e.getMessage());
        }
    }

    public void deliverToAll(String jsonPayload) {
        TextMessage textMessage = new TextMessage(jsonPayload);
        for (WebSocketSession session : activeSessions.values()) {
            if (session.isOpen()) {
                synchronized (session) {
                    try {
                        session.sendMessage(textMessage);
                    } catch (Exception e) {
                        log.error("Failed to broadcast message to session {}: {}", session.getId(), e.getMessage());
                    }
                }
            }
        }
    }

    // ─── Heartbeat ───────────────────────────────────────────────────────────

    private void sendHeartbeats() {
        if (activeSessions.isEmpty()) return;
        try {
            String pingJson = objectMapper.writeValueAsString(Map.of("type", "ping"));
            TextMessage pingMessage = new TextMessage(pingJson);
            for (WebSocketSession session : activeSessions.values()) {
                if (session.isOpen()) {
                    synchronized (session) {
                        try {
                            session.sendMessage(pingMessage);
                        } catch (Exception e) {
                            log.debug("Failed to send ping heartbeat to session {}: {}", session.getId(), e.getMessage());
                        }
                    }
                }
            }
        } catch (Exception e) {
            log.error("Error generating ping message: {}", e.getMessage());
        }
    }

    // ─── Rate Limiting ───────────────────────────────────────────────────────

    private boolean isRateLimitAllowed(String userId) {
        Bucket bucket = rateLimitBuckets.computeIfAbsent(userId, id -> {
            int maxMsgs = appProperties.getWs().getRateLimit().getMaxMessages();
            int windowSecs = appProperties.getWs().getRateLimit().getWindowSeconds();
            Bandwidth limit = Bandwidth.classic(maxMsgs,
                Refill.greedy(maxMsgs, Duration.ofSeconds(windowSecs)));
            return Bucket.builder().addLimit(limit).build();
        });
        return bucket.tryConsume(1);
    }

    // ─── Internal Helper ─────────────────────────────────────────────────────

    private String getUserIdFromSession(WebSocketSession session) {
        String path = session.getUri() != null ? session.getUri().getPath() : null;
        if (path != null && path.contains("/ws/")) {
            int idx = path.indexOf("/ws/");
            return path.substring(idx + 4);
        }
        return null;
    }
}
