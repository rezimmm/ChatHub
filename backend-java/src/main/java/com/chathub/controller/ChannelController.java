package com.chathub.controller;

import com.chathub.dto.ChannelCreateRequest;
import com.chathub.dto.ChannelResponse;
import com.chathub.dto.ChannelUpdateRequest;
import com.chathub.dto.MemberActionRequest;
import com.chathub.model.Channel;
import com.chathub.model.User;
import com.chathub.repository.UserRepository;
import com.chathub.service.ChannelService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/channels")
@RequiredArgsConstructor
public class ChannelController {

    private final ChannelService channelService;
    private final UserRepository userRepository;

    @GetMapping
    public ResponseEntity<List<ChannelResponse>> getChannels(
            @AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(channelService.getChannelsForUser(userDetails.getUsername()));
    }

    @PostMapping
    public ResponseEntity<Channel> createChannel(
            @Valid @RequestBody ChannelCreateRequest request,
            @AuthenticationPrincipal UserDetails userDetails) {

        Channel ch = channelService.createChannel(
            request.getName(),
            request.getDescription(),
            request.isDm(),
            request.getMembers() != null ? request.getMembers() : List.of(),
            userDetails.getUsername(),
            request.isPrivate(),
            request.getPassword()
        );
        return ResponseEntity.ok(ch);
    }

    @GetMapping("/{channelId}")
    public ResponseEntity<Channel> getChannel(
            @PathVariable String channelId,
            @AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(channelService.getChannelByIdForMember(channelId, userDetails.getUsername()));
    }

    @PutMapping("/{channelId}")
    public ResponseEntity<Channel> updateChannel(
            @PathVariable String channelId,
            @Valid @RequestBody ChannelUpdateRequest request,
            @AuthenticationPrincipal UserDetails userDetails) {

        Channel ch = channelService.updateChannel(
            channelId, request.getName(), request.getDescription(), userDetails.getUsername());
        return ResponseEntity.ok(ch);
    }

    @PostMapping("/{channelId}/members")
    public ResponseEntity<Map<String, Object>> addMember(
            @PathVariable String channelId,
            @Valid @RequestBody MemberActionRequest request,
            @AuthenticationPrincipal UserDetails userDetails) {

        channelService.addMember(channelId, request.getUserId(), userDetails.getUsername());
        return ResponseEntity.ok(Map.of("success", true));
    }

    @DeleteMapping("/{channelId}/members/{userId}")
    public ResponseEntity<Map<String, Object>> removeMember(
            @PathVariable String channelId,
            @PathVariable String userId,
            @AuthenticationPrincipal UserDetails userDetails) {

        channelService.removeMember(channelId, userId, userDetails.getUsername());
        return ResponseEntity.ok(Map.of("success", true));
    }

    @GetMapping("/{channelId}/members")
    public ResponseEntity<Map<String, Object>> getMembers(
            @PathVariable String channelId,
            @AuthenticationPrincipal UserDetails userDetails) {

        Channel ch = channelService.getChannelByIdForMember(channelId, userDetails.getUsername());
        List<User> members = userRepository.findAll().stream()
            .filter(u -> ch.getMembers().contains(u.getId()))
            .toList();

        return ResponseEntity.ok(Map.of(
            "members", members.stream().map(u -> u.withoutPassword()).toList(),
            "created_by", ch.getCreatedBy()
        ));
    }

    @PutMapping("/{channelId}/favorite")
    public ResponseEntity<Map<String, Object>> toggleFavorite(
            @PathVariable String channelId,
            @AuthenticationPrincipal UserDetails userDetails) {

        boolean isFav = channelService.toggleFavorite(channelId, userDetails.getUsername());
        return ResponseEntity.ok(Map.of("favorite", isFav));
    }

    @PutMapping("/{channelId}/read")
    public ResponseEntity<Map<String, Object>> markRead(
            @PathVariable String channelId,
            @AuthenticationPrincipal UserDetails userDetails) {

        channelService.markRead(channelId, userDetails.getUsername());
        return ResponseEntity.ok(Map.of("success", true));
    }

    @PostMapping("/{channelId}/read-all")
    public ResponseEntity<Map<String, Object>> markAllRead(
            @PathVariable String channelId,
            @AuthenticationPrincipal UserDetails userDetails) {

        channelService.markRead(channelId, userDetails.getUsername());
        return ResponseEntity.ok(Map.of("success", true));
    }
}
