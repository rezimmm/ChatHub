package com.chathub.service;

import com.chathub.model.UnreadCount;
import com.chathub.repository.UnreadCountRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class UnreadCountService {

    private final UnreadCountRepository unreadCountRepository;

    /** Get unread count for a specific user+channel pair */
    public int getCount(String userId, String channelId) {
        return unreadCountRepository.findByUserIdAndChannelId(userId, channelId)
            .map(UnreadCount::getCount)
            .orElse(0);
    }

    /** Get all unread counts for a user, keyed by channelId */
    public Map<String, Integer> getAllForUser(String userId) {
        return unreadCountRepository.findByUserId(userId).stream()
            .collect(Collectors.toMap(UnreadCount::getChannelId, UnreadCount::getCount));
    }

    /** Increment unread count for all members except the sender */
    public void incrementForMembers(String channelId, List<String> memberIds, String senderId) {
        for (String memberId : memberIds) {
            if (memberId.equals(senderId)) continue;

            UnreadCount uc = unreadCountRepository
                .findByUserIdAndChannelId(memberId, channelId)
                .orElseGet(() -> UnreadCount.builder()
                    .userId(memberId)
                    .channelId(channelId)
                    .count(0)
                    .build());

            uc.setCount(uc.getCount() + 1);
            uc.setUpdatedAt(Instant.now().toString());
            unreadCountRepository.save(uc);
        }
    }

    /** Reset unread count to 0 for a user+channel */
    public void resetCount(String userId, String channelId) {
        unreadCountRepository.findByUserIdAndChannelId(userId, channelId)
            .ifPresent(uc -> {
                uc.setCount(0);
                uc.setUpdatedAt(Instant.now().toString());
                unreadCountRepository.save(uc);
            });
    }

    /** Initialize unread count for a new channel member */
    public void initForMember(String userId, String channelId) {
        if (unreadCountRepository.findByUserIdAndChannelId(userId, channelId).isEmpty()) {
            unreadCountRepository.save(UnreadCount.builder()
                .userId(userId)
                .channelId(channelId)
                .count(0)
                .build());
        }
    }
}
