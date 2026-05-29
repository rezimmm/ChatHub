package com.chathub.websocket;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.connection.Message;
import org.springframework.data.redis.connection.MessageListener;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.util.Map;

/**
 * Receives messages from Redis pub/sub and fans them out
 * to locally connected WebSocket (STOMP) sessions.
 *
 * Subscribed to pattern "chathub:*" via RedisConfig.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class RedisSubscriberService implements MessageListener {

    private final SimpMessagingTemplate messagingTemplate;
    private static final ObjectMapper MAPPER = new ObjectMapper();

    @Override
    public void onMessage(Message message, byte[] pattern) {
        try {
            String channel = new String(message.getChannel());
            String body = new String(message.getBody());

            Map<String, Object> payload = MAPPER.readValue(body, Map.class);

            if (channel.startsWith("chathub:channel:")) {
                String channelId = channel.substring("chathub:channel:".length());
                // Fan-out to all STOMP subscribers of this channel topic
                messagingTemplate.convertAndSend("/topic/channel/" + channelId, payload);

            } else if (channel.startsWith("chathub:user:")) {
                String userId = channel.substring("chathub:user:".length());
                messagingTemplate.convertAndSendToUser(userId, "/queue/messages", payload);

            } else if ("chathub:broadcast".equals(channel)) {
                // Presence broadcasts go to /topic/presence
                messagingTemplate.convertAndSend("/topic/presence", payload);
            }

        } catch (Exception e) {
            log.error("Error processing Redis message: {}", e.getMessage());
        }
    }
}
