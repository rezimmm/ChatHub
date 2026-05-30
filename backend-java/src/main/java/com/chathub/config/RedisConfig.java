package com.chathub.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.listener.PatternTopic;
import org.springframework.data.redis.listener.RedisMessageListenerContainer;
import org.springframework.data.redis.listener.adapter.MessageListenerAdapter;
import org.springframework.data.redis.serializer.GenericJackson2JsonRedisSerializer;
import org.springframework.data.redis.serializer.StringRedisSerializer;

import com.chathub.websocket.RedisSubscriberService;

@Configuration
public class RedisConfig {

    /**
     * Main Redis template used to publish messages to Redis pub/sub channels.
     */
    @Bean
    public RedisTemplate<String, String> redisTemplate(RedisConnectionFactory factory) {
        RedisTemplate<String, String> template = new RedisTemplate<>();
        template.setConnectionFactory(factory);
        template.setKeySerializer(new StringRedisSerializer());
        template.setValueSerializer(new StringRedisSerializer());
        template.setHashKeySerializer(new StringRedisSerializer());
        template.setHashValueSerializer(new StringRedisSerializer());
        return template;
    }



    /**
     * Subscriber container — listens to "chathub:*" pattern.
     * RedisSubscriberService handles the messages and fans out to local WS sessions.
     */
    @Bean
    public RedisMessageListenerContainer redisMessageListenerContainer(
            RedisConnectionFactory factory,
            RedisSubscriberService subscriberService) {

        RedisMessageListenerContainer container = new RedisMessageListenerContainer();
        container.setConnectionFactory(factory);

        MessageListenerAdapter listenerAdapter = new MessageListenerAdapter(subscriberService, "onMessage");
        listenerAdapter.setSerializer(new StringRedisSerializer());
        listenerAdapter.afterPropertiesSet();

        // Subscribe to ALL chathub channels via pattern
        container.addMessageListener(listenerAdapter, new PatternTopic("chathub:*"));
        return container;
    }
}
