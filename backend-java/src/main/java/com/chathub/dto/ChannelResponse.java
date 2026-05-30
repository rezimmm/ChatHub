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
    private boolean isDm;
    private boolean isPrivate;
    private List<String> members;
    private String createdBy;
    private String createdAt;
    private List<String> isFavorite;
    private List<String> isMuted;
    private int unreadCount;  // flattened per requesting user

    public static ChannelResponse from(com.chathub.model.Channel channel, int unreadCount) {
        return ChannelResponse.builder()
            .id(channel.getId())
            .name(channel.getName())
            .description(channel.getDescription())
            .isDm(channel.isDm())
            .isPrivate(channel.isPrivate())
            .members(channel.getMembers())
            .createdBy(channel.getCreatedBy())
            .createdAt(channel.getCreatedAt())
            .isFavorite(channel.getIsFavorite())
            .isMuted(channel.getIsMuted())
            .unreadCount(unreadCount)
            .build();
    }
}
