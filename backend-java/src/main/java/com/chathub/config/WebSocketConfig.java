package com.chathub.config;

import com.chathub.websocket.ChatWebSocketHandler;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

import java.util.ArrayList;
import java.util.List;

@Configuration
@EnableWebSocket
public class WebSocketConfig implements WebSocketConfigurer {

    private final ChatWebSocketHandler chatWebSocketHandler;
    private final AppProperties appProperties;

    public WebSocketConfig(ChatWebSocketHandler chatWebSocketHandler, AppProperties appProperties) {
        this.chatWebSocketHandler = chatWebSocketHandler;
        this.appProperties = appProperties;
    }

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        List<String> rawOrigins = appProperties.getCors().getAllowedOrigins();
        List<String> resolvedOrigins = new ArrayList<>();
        if (rawOrigins != null) {
            for (String origin : rawOrigins) {
                if (origin.contains(",")) {
                    for (String split : origin.split(",")) {
                        resolvedOrigins.add(split.trim());
                    }
                } else {
                    resolvedOrigins.add(origin.trim());
                }
            }
        }

        // Register raw WebSocket handlers at /api/ws/{userId} and /ws/{userId}
        registry.addHandler(chatWebSocketHandler, "/api/ws/{userId}", "/ws/{userId}")
            .setAllowedOrigins(resolvedOrigins.toArray(new String[0]));
    }
}
