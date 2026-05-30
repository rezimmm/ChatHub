package com.chathub.websocket;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.connection.Message;
import org.springframework.data.redis.connection.MessageListener;
import org.springframework.stereotype.Service;

import java.util.Map;

/**
 * Receives messages from Redis pub/sub and fans them out
 * to locally connected raw WebSocket sessions.
 *
 * Subscribed to pattern "chathub:*" via RedisConfig.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class RedisSubscriberService implements MessageListener {

    private final ChatWebSocketHandler chatWebSocketHandler;
    private final ObjectMapper objectMapper;

    @Override
    public void onMessage(Message message, byte[] pattern) {
        try {
            String channel = new String(message.getChannel());
            String body = new String(message.getBody());

            // Validate that the body is valid JSON
            objectMapper.readTree(body);

            if (channel.startsWith("chathub:channel:")) {
                String channelId = channel.substring("chathub:channel:".length());
                // Fan-out to all raw WebSocket sessions subscribed/members of this channel
                chatWebSocketHandler.deliverToChannel(channelId, body);

            } else if (channel.startsWith("chathub:user:")) {
                String userId = channel.substring("chathub:user:".length());
                chatWebSocketHandler.deliverToUser(userId, body);

            } else if ("chathub:broadcast".equals(channel)) {
                // Presence broadcasts go to all active sessions
                chatWebSocketHandler.deliverToAll(body);
            }

        } catch (Exception e) {
            log.error("Error processing Redis message: {}", e.getMessage());
        }
    }
}
