package com.chathub.service;

import com.chathub.dto.ChannelResponse;
import com.chathub.model.Channel;
import com.chathub.repository.ChannelRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class ChannelService {

    private final ChannelRepository channelRepository;
    private final UnreadCountService unreadCountService;

    // ─── Get channels for user ─────────────────────────────────────────────────

    public List<ChannelResponse> getChannelsForUser(String userId) {
        return channelRepository.findByMembersContaining(userId).stream()
            .map(ch -> ChannelResponse.from(ch, unreadCountService.getCount(userId, ch.getId())))
            .collect(Collectors.toList());
    }

    // ─── Get single channel ────────────────────────────────────────────────────

    public Channel getChannelById(String channelId) {
        return channelRepository.findByChannelId(channelId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Channel not found"));
    }

    public Channel getChannelByIdForMember(String channelId, String userId) {
        Channel ch = getChannelById(channelId);
        if (!ch.getMembers().contains(userId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied");
        }
        return ch;
    }

    // ─── Create channel ────────────────────────────────────────────────────────

    public Channel createChannel(String name, String description, boolean isDm,
                                  List<String> members, String creatorId) {
        List<String> allMembers = members.stream().collect(Collectors.toList());
        if (!allMembers.contains(creatorId)) {
            allMembers.add(creatorId);
        }

        Channel channel = Channel.builder()
            .name(sanitize(name))
            .description(description != null ? sanitize(description) : "")
            .isDm(isDm)
            .members(allMembers)
            .createdBy(creatorId)
            .build();

        channelRepository.save(channel);

        // Initialize unread counts for all members
        allMembers.forEach(memberId -> unreadCountService.initForMember(memberId, channel.getId()));

        return channel;
    }

    // ─── Ensure general channel ────────────────────────────────────────────────

    public void ensureGeneralChannel(String userId) {
        Optional<Channel> general = channelRepository.findByName("general");
        if (general.isEmpty()) {
            createChannel("general", "General discussion", false, List.of(userId), userId);
        } else {
            Channel ch = general.get();
            if (!ch.getMembers().contains(userId)) {
                ch.getMembers().add(userId);
                channelRepository.save(ch);
                unreadCountService.initForMember(userId, ch.getId());
            }
        }
    }

    // ─── Update channel ────────────────────────────────────────────────────────

    public Channel updateChannel(String channelId, String name, String description, String requesterId) {
        Channel ch = getChannelById(channelId);
        if (!ch.getCreatedBy().equals(requesterId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only the channel creator can edit");
        }
        if (ch.isDm()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cannot edit DM channels");
        }
        if (name != null) ch.setName(sanitize(name));
        if (description != null) ch.setDescription(sanitize(description));
        channelRepository.save(ch);
        return ch;
    }

    // ─── Member management ────────────────────────────────────────────────────

    public void addMember(String channelId, String targetUserId, String requesterId) {
        Channel ch = getChannelByIdForMember(channelId, requesterId);
        if (ch.isDm()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cannot add members to DM channels");
        }
        if (!ch.getMembers().contains(targetUserId)) {
            ch.getMembers().add(targetUserId);
            channelRepository.save(ch);
            unreadCountService.initForMember(targetUserId, channelId);
        }
    }

    public void removeMember(String channelId, String targetUserId, String requesterId) {
        Channel ch = getChannelById(channelId);
        if (ch.isDm()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cannot remove members from DM channels");
        }
        if (!requesterId.equals(ch.getCreatedBy()) && !requesterId.equals(targetUserId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Not authorized");
        }
        if (targetUserId.equals(ch.getCreatedBy())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cannot remove channel creator");
        }
        ch.getMembers().remove(targetUserId);
        channelRepository.save(ch);
    }

    // ─── Favorite toggle ──────────────────────────────────────────────────────

    public boolean toggleFavorite(String channelId, String userId) {
        Channel ch = getChannelByIdForMember(channelId, userId);
        boolean isFav = ch.getIsFavorite().contains(userId);
        if (isFav) {
            ch.getIsFavorite().remove(userId);
        } else {
            ch.getIsFavorite().add(userId);
        }
        channelRepository.save(ch);
        return !isFav;
    }

    // ─── Mark read ────────────────────────────────────────────────────────────

    public void markRead(String channelId, String userId) {
        unreadCountService.resetCount(userId, channelId);
    }

    // ─── Internal ─────────────────────────────────────────────────────────────

    private String sanitize(String input) {
        if (input == null) return "";
        return input.strip().replace("<", "&lt;").replace(">", "&gt;");
    }
}
