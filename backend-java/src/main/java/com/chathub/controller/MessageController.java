package com.chathub.controller;

import com.chathub.dto.MessageCreateRequest;
import com.chathub.dto.MessageUpdateRequest;
import com.chathub.dto.ReactionRequest;
import com.chathub.model.Message;
import com.chathub.model.User;
import com.chathub.repository.UserRepository;
import com.chathub.service.MessageService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class MessageController {

    private final MessageService messageService;
    private final UserRepository userRepository;

    @GetMapping("/channels/{channelId}/messages")
    public ResponseEntity<List<Message>> getMessages(
            @PathVariable String channelId,
            @RequestParam(defaultValue = "50") int limit,
            @RequestParam(required = false) String before,
            @AuthenticationPrincipal UserDetails userDetails) {

        int safeLimit = Math.min(Math.max(limit, 1), 100);
        return ResponseEntity.ok(
            messageService.getMessages(channelId, safeLimit, before, userDetails.getUsername()));
    }

    @PostMapping("/messages")
    public ResponseEntity<Message> sendMessage(
            @Valid @RequestBody MessageCreateRequest request,
            @AuthenticationPrincipal UserDetails userDetails) {

        User user = userRepository.findByUserId(userDetails.getUsername()).orElseThrow();

        Message msg = messageService.sendMessage(
            request.getChannelId(), request.getContent(),
            request.getReplyTo(), request.getThreadId(),
            user.getId(), user.getUsername(),
            user.getAvatarColor(), user.getAvatarUrl()
        );
        return ResponseEntity.ok(msg);
    }

    @PutMapping("/messages/{messageId}")
    public ResponseEntity<Message> editMessage(
            @PathVariable String messageId,
            @Valid @RequestBody MessageUpdateRequest request,
            @AuthenticationPrincipal UserDetails userDetails) {

        return ResponseEntity.ok(
            messageService.editMessage(messageId, request.getContent(), userDetails.getUsername()));
    }

    @DeleteMapping("/messages/{messageId}")
    public ResponseEntity<Map<String, Object>> deleteMessage(
            @PathVariable String messageId,
            @AuthenticationPrincipal UserDetails userDetails) {

        messageService.deleteMessage(messageId, userDetails.getUsername());
        return ResponseEntity.ok(Map.of("success", true));
    }

    @PostMapping("/messages/{messageId}/reactions")
    public ResponseEntity<Message> toggleReaction(
            @PathVariable String messageId,
            @Valid @RequestBody ReactionRequest request,
            @AuthenticationPrincipal UserDetails userDetails) {

        User user = userRepository.findByUserId(userDetails.getUsername()).orElseThrow();
        return ResponseEntity.ok(
            messageService.toggleReaction(messageId, request.getEmoji(),
                user.getId(), user.getUsername()));
    }

    @PostMapping("/messages/{messageId}/pin")
    public ResponseEntity<Map<String, Object>> togglePin(
            @PathVariable String messageId,
            @AuthenticationPrincipal UserDetails userDetails) {

        boolean pinned = messageService.togglePin(messageId, userDetails.getUsername());
        return ResponseEntity.ok(Map.of("pinned", pinned));
    }

    @PostMapping("/messages/{messageId}/read")
    public ResponseEntity<Map<String, Object>> markRead(
            @PathVariable String messageId,
            @AuthenticationPrincipal UserDetails userDetails) {

        messageService.markRead(messageId, userDetails.getUsername());
        return ResponseEntity.ok(Map.of("success", true));
    }

    @GetMapping("/messages/{messageId}/thread")
    public ResponseEntity<List<Message>> getThread(
            @PathVariable String messageId,
            @AuthenticationPrincipal UserDetails userDetails) {

        return ResponseEntity.ok(messageService.getThread(messageId, userDetails.getUsername()));
    }

    @GetMapping("/messages/search")
    public ResponseEntity<List<Message>> search(
            @RequestParam String q,
            @AuthenticationPrincipal UserDetails userDetails) {

        return ResponseEntity.ok(messageService.search(q, userDetails.getUsername()));
    }
}
