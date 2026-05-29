package com.chathub.controller;

import com.chathub.dto.InviteCreateRequest;
import com.chathub.model.InviteLink;
import com.chathub.service.InviteService;
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
public class InviteController {

    private final InviteService inviteService;

    @PostMapping("/channels/{channelId}/invites")
    public ResponseEntity<InviteLink> createInvite(
            @PathVariable String channelId,
            @Valid @RequestBody InviteCreateRequest request,
            @AuthenticationPrincipal UserDetails userDetails) {

        return ResponseEntity.ok(inviteService.createInvite(
            channelId, userDetails.getUsername(),
            request.getExpiresInHours(), request.getMaxUses()));
    }

    @GetMapping("/channels/{channelId}/invites")
    public ResponseEntity<List<InviteLink>> listInvites(
            @PathVariable String channelId,
            @AuthenticationPrincipal UserDetails userDetails) {

        return ResponseEntity.ok(inviteService.listInvites(channelId, userDetails.getUsername()));
    }

    @DeleteMapping("/invites/{inviteId}")
    public ResponseEntity<Map<String, Object>> revokeInvite(
            @PathVariable String inviteId,
            @AuthenticationPrincipal UserDetails userDetails) {

        inviteService.revokeInvite(inviteId, userDetails.getUsername());
        return ResponseEntity.ok(Map.of("success", true));
    }

    /** Public endpoint — no auth required */
    @GetMapping("/invites/{token}/info")
    public ResponseEntity<Map<String, Object>> getInviteInfo(@PathVariable String token) {
        return ResponseEntity.ok(inviteService.getInviteInfo(token));
    }

    @PostMapping("/invites/{token}/join")
    public ResponseEntity<Map<String, Object>> joinViaInvite(
            @PathVariable String token,
            @AuthenticationPrincipal UserDetails userDetails) {

        return ResponseEntity.ok(inviteService.joinViaInvite(token, userDetails.getUsername()));
    }
}
