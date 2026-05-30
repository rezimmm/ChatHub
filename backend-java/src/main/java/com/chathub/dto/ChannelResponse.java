package com.chathub.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ChannelResponse {
    private String id;
    private String name;
    private String description;
    @com.fasterxml.jackson.annotation.JsonProperty("is_dm")
    private boolean isDm;
    private List<String> members;
    private String createdBy;
    private String createdAt;
    @com.fasterxml.jackson.annotation.JsonProperty("is_favorite")
    private List<String> isFavorite;
    @com.fasterxml.jackson.annotation.JsonProperty("is_muted")
    private List<String> isMuted;
    @com.fasterxml.jackson.annotation.JsonProperty("unread_count")
    private int unreadCount;  // flattened per requesting user

    public static ChannelResponse from(com.chathub.model.Channel channel, int unreadCount) {
        return ChannelResponse.builder()
            .id(channel.getId())
            .name(channel.getName())
            .description(channel.getDescription())
            .isDm(channel.isDm())
            .members(channel.getMembers())
            .createdBy(channel.getCreatedBy())
            .createdAt(channel.getCreatedAt())
            .isFavorite(channel.getIsFavorite())
            .isMuted(channel.getIsMuted())
            .unreadCount(unreadCount)
            .build();
    }
}
