package com.chathub.websocket;

import com.chathub.config.AppProperties;
import com.chathub.service.UserService;
import com.chathub.websocket.WebSocketPublisher;
import io.github.bucket4j.Bandwidth;
import io.github.bucket4j.Bucket;
import io.github.bucket4j.Refill;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;
import org.springframework.web.socket.messaging.SessionConnectedEvent;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@Controller
@RequiredArgsConstructor
public class ChatWebSocketHandler {

    private final WebSocketPublisher wsPublisher;
    private final UserService userService;
    private final AppProperties appProperties;
    private final SimpMessagingTemplate messagingTemplate;

    // Rate limiter buckets per user (in-memory token bucket via Bucket4j)
    private final ConcurrentHashMap<String, Bucket> rateLimitBuckets = new ConcurrentHashMap<>();

    // Track session → userId mapping for disconnect events
    private final ConcurrentHashMap<String, String> sessionUserMap = new ConcurrentHashMap<>();

    // ─── Connect event ────────────────────────────────────────────────────────

    @EventListener
    public void handleConnect(SessionConnectedEvent event) {
        SimpMessageHeaderAccessor accessor = SimpMessageHeaderAccessor.wrap(event.getMessage());
        String sessionId = accessor.getSessionId();
        String userId = getUserIdFromSession(accessor);

        if (userId != null) {
            sessionUserMap.put(sessionId, userId);
            userService.setOnline(userId, true);
            wsPublisher.broadcastUserStatus(userId, true, "online", Instant.now().toString());
            log.info("User {} connected (session {})", userId, sessionId);
        }
    }

    // ─── Disconnect event ─────────────────────────────────────────────────────

    @EventListener
    public void handleDisconnect(SessionDisconnectEvent event) {
        String sessionId = event.getSessionId();
        String userId = sessionUserMap.remove(sessionId);

        if (userId != null) {
            userService.setOnline(userId, false);
            wsPublisher.broadcastUserStatus(userId, false, "offline", Instant.now().toString());
            rateLimitBuckets.remove(userId);
            log.info("User {} disconnected (session {})", userId, sessionId);
        }
    }

    // ─── Typing indicator ─────────────────────────────────────────────────────

    @MessageMapping("/typing")
    public void handleTyping(@Payload Map<String, Object> payload,
                              SimpMessageHeaderAccessor headerAccessor) {
        String userId = getUserIdFromSession(headerAccessor);
        if (userId == null) return;

        if (!isRateLimitAllowed(userId)) {
            log.warn("WS rate limit exceeded for user {}", userId);
            return;
        }

        String channelId = (String) payload.get("channel_id");
        if (channelId != null) {
            wsPublisher.publishToChannel(channelId, Map.of(
                "type", "typing",
                "user_id", userId,
                "username", payload.getOrDefault("username", ""),
                "channel_id", channelId,
                "is_typing", payload.getOrDefault("is_typing", false)
            ));
        }
    }

    // ─── Ping / Pong ──────────────────────────────────────────────────────────

    @MessageMapping("/ping")
    public void handlePing(SimpMessageHeaderAccessor headerAccessor) {
        String userId = getUserIdFromSession(headerAccessor);
        if (userId != null) {
            messagingTemplate.convertAndSendToUser(userId, "/queue/messages",
                Map.of("type", "pong", "timestamp", Instant.now().toString()));
        }
    }

    // ─── Rate limiter (Bucket4j token bucket) ────────────────────────────────

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

    // ─── Internal ─────────────────────────────────────────────────────────────

    private String getUserIdFromSession(SimpMessageHeaderAccessor accessor) {
        if (accessor.getUser() != null) {
            return accessor.getUser().getName();
        }
        Map<String, Object> attrs = accessor.getSessionAttributes();
        if (attrs != null) {
            return (String) attrs.get("userId");
        }
        return null;
    }
}
