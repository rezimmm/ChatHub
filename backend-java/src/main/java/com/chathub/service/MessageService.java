package com.chathub.service;

import com.chathub.model.Channel;
import com.chathub.model.Message;
import com.chathub.model.Reaction;
import com.chathub.repository.ChannelRepository;
import com.chathub.repository.MessageRepository;
import com.chathub.websocket.WebSocketPublisher;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class MessageService {

    private final MessageRepository messageRepository;
    private final ChannelRepository channelRepository;
    private final UnreadCountService unreadCountService;
    private final WebSocketPublisher wsPublisher;

    // ─── Get messages (paginated) ──────────────────────────────────────────────

    public List<Message> getMessages(String channelId, int limit, String before, String userId) {
        assertChannelMember(channelId, userId);

        Sort sort = Sort.by(Sort.Direction.DESC, "timestamp");
        List<Message> messages;

        if (before != null && !before.isBlank()) {
            messages = messageRepository.findByChannelIdBefore(channelId, before, sort);
        } else {
            messages = messageRepository.findByChannelId(channelId, sort);
        }

        // Limit and reverse for chronological order
        List<Message> paged = messages.stream().limit(limit).collect(Collectors.toList());
        Collections.reverse(paged);
        return paged;
    }

    // ─── Send message ─────────────────────────────────────────────────────────

    public Message sendMessage(String channelId, String content, String replyTo,
                                String threadId, String userId, String username,
                                String avatarColor, String avatarUrl) {
        Channel channel = getChannelForMember(channelId, userId);

        content = sanitize(content);
        if (content.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Message cannot be empty");
        }

        Message message = Message.builder()
            .channelId(channelId)
            .userId(userId)
            .username(username)
            .content(content)
            .avatarColor(avatarColor != null ? avatarColor : "#7c3aed")
            .avatarUrl(avatarUrl)
            .replyTo(replyTo)
            .threadId(threadId)
            .readBy(new ArrayList<>(List.of(userId)))
            .build();

        messageRepository.save(message);

        // If thread reply, increment parent's reply count
        if (threadId != null && !threadId.isBlank()) {
            messageRepository.findByMessageId(threadId).ifPresent(parent -> {
                parent.setReplyCount(parent.getReplyCount() + 1);
                messageRepository.save(parent);
                wsPublisher.publishToChannel(channelId, Map.of("type", "thread_updated", "data", parent));
            });
        }

        // Broadcast new message to channel via Redis pub/sub
        wsPublisher.publishToChannel(channelId, Map.of("type", "message", "data", message));

        // Increment unread counts for other members
        unreadCountService.incrementForMembers(channelId, channel.getMembers(), userId);

        return message;
    }

    // ─── Edit message ─────────────────────────────────────────────────────────

    public Message editMessage(String messageId, String content, String userId) {
        Message message = getMessageById(messageId);
        if (!message.getUserId().equals(userId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Not authorized");
        }

        content = sanitize(content);
        if (content.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Message cannot be empty");
        }

        message.setContent(content);
        message.setEdited(true);
        message.setEditedAt(Instant.now().toString());
        messageRepository.save(message);

        wsPublisher.publishToChannel(message.getChannelId(),
            Map.of("type", "message_updated", "data", message));

        return message;
    }

    // ─── Delete message ───────────────────────────────────────────────────────

    public void deleteMessage(String messageId, String userId) {
        Message message = getMessageById(messageId);
        if (!message.getUserId().equals(userId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Not authorized");
        }

        String channelId = message.getChannelId();
        messageRepository.delete(message);

        wsPublisher.publishToChannel(channelId,
            Map.of("type", "message_deleted", "message_id", messageId));
    }

    // ─── Reactions ────────────────────────────────────────────────────────────

    public Message toggleReaction(String messageId, String emoji, String userId, String username) {
        Message message = getMessageById(messageId);

        List<Reaction> reactions = message.getReactions();
        Optional<Reaction> existing = reactions.stream()
            .filter(r -> r.getUserId().equals(userId) && r.getEmoji().equals(emoji))
            .findFirst();

        if (existing.isPresent()) {
            reactions.remove(existing.get());
        } else {
            reactions.add(Reaction.builder().emoji(emoji).userId(userId).username(username).build());
        }

        messageRepository.save(message);

        wsPublisher.publishToChannel(message.getChannelId(),
            Map.of("type", "reaction_updated", "data", message));

        return message;
    }

    // ─── Pin / unpin ──────────────────────────────────────────────────────────

    public boolean togglePin(String messageId, String userId) {
        Message message = getMessageById(messageId);
        assertChannelMember(message.getChannelId(), userId);

        boolean newPinned = !message.isPinned();
        message.setPinned(newPinned);
        messageRepository.save(message);

        wsPublisher.publishToChannel(message.getChannelId(),
            Map.of("type", "message_updated", "data", message));

        return newPinned;
    }

    // ─── Read receipt ─────────────────────────────────────────────────────────

    public void markRead(String messageId, String userId) {
        Message message = getMessageById(messageId);
        if (!message.getReadBy().contains(userId)) {
            message.getReadBy().add(userId);
            messageRepository.save(message);

            wsPublisher.publishToChannel(message.getChannelId(), Map.of(
                "type", "message_read",
                "message_id", messageId,
                "user_id", userId
            ));
        }
    }

    // ─── Thread ───────────────────────────────────────────────────────────────

    public List<Message> getThread(String parentMessageId, String userId) {
        Message parent = getMessageById(parentMessageId);
        assertChannelMember(parent.getChannelId(), userId);

        return messageRepository.findByThreadId(parentMessageId,
            Sort.by(Sort.Direction.ASC, "timestamp"));
    }

    // ─── Search ───────────────────────────────────────────────────────────────

    public List<Message> search(String query, String userId) {
        List<Channel> channels = channelRepository.findByMembersContaining(userId);
        List<String> channelIds = channels.stream().map(Channel::getId).collect(Collectors.toList());

        return messageRepository.searchInChannels(channelIds, query,
            Sort.by(Sort.Direction.DESC, "timestamp"))
            .stream().limit(50).collect(Collectors.toList());
    }

    // ─── Mark all read in channel ─────────────────────────────────────────────

    public void markAllRead(String channelId, String userId) {
        assertChannelMember(channelId, userId);
        unreadCountService.resetCount(userId, channelId);
    }

    // ─── Internal ─────────────────────────────────────────────────────────────

    private Message getMessageById(String messageId) {
        return messageRepository.findByMessageId(messageId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Message not found"));
    }

    private Channel getChannelForMember(String channelId, String userId) {
        Channel channel = channelRepository.findByChannelId(channelId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Channel not found"));
        if (!channel.getMembers().contains(userId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied");
        }
        return channel;
    }

    private void assertChannelMember(String channelId, String userId) {
        Channel channel = channelRepository.findByChannelId(channelId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Channel not found"));
        if (!channel.getMembers().contains(userId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied");
        }
    }

    private String sanitize(String input) {
        if (input == null) return "";
        return input.strip().replace("<", "&lt;").replace(">", "&gt;");
    }
}
