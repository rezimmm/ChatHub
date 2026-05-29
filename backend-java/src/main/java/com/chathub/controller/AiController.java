package com.chathub.controller;

import com.chathub.dto.AiRequest;
import com.chathub.dto.AiResponse;
import com.chathub.service.GeminiAiService;
import com.chathub.service.MessageService;
import com.chathub.repository.MessageRepository;
import com.chathub.model.Message;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;
import java.util.Optional;

@RestController
@RequestMapping("/api/ai")
@RequiredArgsConstructor
public class AiController {

    private final GeminiAiService aiService;
    private final MessageRepository messageRepository;

    /**
     * POST /api/ai/channels/{channelId}/summarize
     * Summarizes the last N messages in a channel.
     */
    @PostMapping("/channels/{channelId}/summarize")
    public ResponseEntity<AiResponse> summarize(
            @PathVariable String channelId,
            @RequestBody(required = false) AiRequest request,
            @AuthenticationPrincipal UserDetails userDetails) {

        int limit = (request != null && request.getLimit() > 0) ? request.getLimit() : 20;
        return ResponseEntity.ok(aiService.summarizeChannel(channelId, limit));
    }

    /**
     * POST /api/ai/messages/{messageId}/smart-reply
     * Returns 3 suggested reply options for a given message.
     */
    @PostMapping("/messages/{messageId}/smart-reply")
    public ResponseEntity<AiResponse> smartReply(
            @PathVariable String messageId,
            @RequestBody(required = false) AiRequest request,
            @AuthenticationPrincipal UserDetails userDetails) {

        String content = "";
        String channelId = "";

        Optional<Message> msgOpt = messageRepository.findByMessageId(messageId);
        if (msgOpt.isPresent()) {
            Message msg = msgOpt.get();
            content = msg.getContent();
            channelId = msg.getChannelId();
        } else if (request != null && request.getPrompt() != null) {
            content = request.getPrompt();
        }

        return ResponseEntity.ok(aiService.smartReplies(content, channelId));
    }

    /**
     * POST /api/ai/channels/{channelId}/chat
     * Ask the AI a question in the context of the channel's recent history.
     */
    @PostMapping("/channels/{channelId}/chat")
    public ResponseEntity<AiResponse> chat(
            @PathVariable String channelId,
            @RequestBody AiRequest request,
            @AuthenticationPrincipal UserDetails userDetails) {

        int limit = (request.getLimit() > 0) ? request.getLimit() : 20;
        String prompt = request.getPrompt() != null ? request.getPrompt() : "What was discussed?";
        return ResponseEntity.ok(aiService.chat(channelId, prompt, limit));
    }
}
