package com.chathub.service;

import com.chathub.config.AppProperties;
import com.chathub.dto.AiResponse;
import com.chathub.model.Message;
import com.chathub.repository.MessageRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import okhttp3.*;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class GeminiAiService {

    private final AppProperties appProperties;
    private final MessageRepository messageRepository;

    private static final OkHttpClient HTTP_CLIENT = new OkHttpClient();
    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final MediaType JSON = MediaType.parse("application/json");

    // ─── Summarize channel ────────────────────────────────────────────────────

    public AiResponse summarizeChannel(String channelId, int limit) {
        List<Message> messages = messageRepository.findByChannelId(channelId,
            Sort.by(Sort.Direction.DESC, "timestamp"))
            .stream().limit(limit).collect(Collectors.toList());
        Collections.reverse(messages);

        if (messages.isEmpty()) {
            return AiResponse.builder().type("summary").summary("No messages to summarize.").build();
        }

        String transcript = messages.stream()
            .map(m -> m.getUsername() + ": " + m.getContent())
            .collect(Collectors.joining("\n"));

        String prompt = "Summarize the following chat conversation concisely in 2-3 sentences. " +
            "Focus on the main topics discussed and any decisions made.\n\n" + transcript;

        String summary = callGemini(prompt);
        return AiResponse.builder().type("summary").summary(summary).build();
    }

    // ─── Smart replies ────────────────────────────────────────────────────────

    public AiResponse smartReplies(String messageContent, String channelId) {
        // Get last 5 messages for context
        List<Message> context = messageRepository.findByChannelId(channelId,
            Sort.by(Sort.Direction.DESC, "timestamp"))
            .stream().limit(5).collect(Collectors.toList());
        Collections.reverse(context);

        String contextStr = context.stream()
            .map(m -> m.getUsername() + ": " + m.getContent())
            .collect(Collectors.joining("\n"));

        String prompt = "Given this chat context:\n" + contextStr +
            "\n\nThe last message is: \"" + messageContent + "\"\n\n" +
            "Generate exactly 3 short, natural reply suggestions (1 sentence each). " +
            "Return them as a JSON array of strings, nothing else. Example: [\"Sure!\",\"Thanks!\",\"Got it.\"]";

        String response = callGemini(prompt);

        // Parse the JSON array response
        List<String> suggestions = new ArrayList<>();
        try {
            // Extract JSON array from response
            int start = response.indexOf('[');
            int end = response.lastIndexOf(']');
            if (start >= 0 && end > start) {
                String json = response.substring(start, end + 1);
                JsonNode arr = MAPPER.readTree(json);
                arr.forEach(node -> suggestions.add(node.asText()));
            }
        } catch (Exception e) {
            log.warn("Failed to parse smart replies, using raw response: {}", e.getMessage());
            suggestions.add(response.trim());
        }

        return AiResponse.builder().type("smart_replies").suggestions(suggestions).build();
    }

    // ─── Chat with AI about channel ───────────────────────────────────────────

    public AiResponse chat(String channelId, String userPrompt, int contextLimit) {
        List<Message> context = messageRepository.findByChannelId(channelId,
            Sort.by(Sort.Direction.DESC, "timestamp"))
            .stream().limit(contextLimit).collect(Collectors.toList());
        Collections.reverse(context);

        String contextStr = context.stream()
            .map(m -> m.getUsername() + ": " + m.getContent())
            .collect(Collectors.joining("\n"));

        String prompt = "You are an AI assistant for a team chat application. " +
            "Here is the recent conversation:\n\n" + contextStr +
            "\n\nUser question: " + userPrompt;

        String reply = callGemini(prompt);
        return AiResponse.builder().type("chat").reply(reply).build();
    }

    // ─── Internal Gemini REST call ────────────────────────────────────────────

    private String callGemini(String prompt) {
        String apiKey = appProperties.getGemini().getApiKey();
        if (apiKey == null || apiKey.isBlank()) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                "Gemini API key not configured. Set GEMINI_API_KEY environment variable.");
        }

        String model = appProperties.getGemini().getModel();
        String url = appProperties.getGemini().getBaseUrl()
            + "/models/" + model + ":generateContent?key=" + apiKey;

        // Build request body
        ObjectNode requestBody = MAPPER.createObjectNode();
        ArrayNode contents = requestBody.putArray("contents");
        ObjectNode content = contents.addObject();
        ArrayNode parts = content.putArray("parts");
        parts.addObject().put("text", prompt);

        // Generation config
        ObjectNode genConfig = requestBody.putObject("generationConfig");
        genConfig.put("temperature", 0.7);
        genConfig.put("maxOutputTokens", 1024);

        try {
            Request request = new Request.Builder()
                .url(url)
                .post(RequestBody.create(MAPPER.writeValueAsString(requestBody), JSON))
                .addHeader("Content-Type", "application/json")
                .build();

            try (Response response = HTTP_CLIENT.newCall(request).execute()) {
                if (!response.isSuccessful()) {
                    log.error("Gemini API error: {} {}", response.code(), response.message());
                    throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                        "AI service unavailable. Try again later.");
                }

                String bodyStr = response.body().string();
                JsonNode root = MAPPER.readTree(bodyStr);
                return root.path("candidates").get(0)
                    .path("content").path("parts").get(0)
                    .path("text").asText("No response generated.");
            }
        } catch (IOException e) {
            log.error("Gemini call failed: {}", e.getMessage());
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Failed to reach AI service");
        }
    }
}
