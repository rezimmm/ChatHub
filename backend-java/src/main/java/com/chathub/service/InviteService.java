package com.chathub.service;

import com.chathub.model.Channel;
import com.chathub.model.InviteLink;
import com.chathub.repository.ChannelRepository;
import com.chathub.repository.InviteLinkRepository;
import com.chathub.websocket.WebSocketPublisher;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Base64;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class InviteService {

    private final InviteLinkRepository inviteLinkRepository;
    private final ChannelRepository channelRepository;
    private final WebSocketPublisher wsPublisher;

    @Value("${jwt.secret}")
    private String secret;

    // ─── Create invite ─────────────────────────────────────────────────────────

    public InviteLink createInvite(String channelId, String createdBy,
                                    Integer expiresInHours, Integer maxUses) {
        Channel channel = getChannelForMember(channelId, createdBy);
        if (channel.isDm()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                "Cannot create invite for DM channels");
        }

        InviteLink invite = InviteLink.builder()
            .channelId(channelId)
            .createdBy(createdBy)
            .maxUses(maxUses)
            .build();

        if (expiresInHours != null) {
            invite.setExpiresAt(Instant.now().plus(expiresInHours, ChronoUnit.HOURS).toString());
        }

        // Generate HMAC-SHA256 signed token
        invite.setToken(generateToken(channelId, invite.getId(), invite.getCreatedAt()));

        inviteLinkRepository.save(invite);
        return invite;
    }

    // ─── Get invite info (public) ──────────────────────────────────────────────

    public Map<String, Object> getInviteInfo(String token) {
        InviteLink invite = inviteLinkRepository.findByTokenAndActive(token)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                "Invite link not found or revoked"));

        validateInvite(invite, token);

        Channel channel = channelRepository.findByChannelId(invite.getChannelId())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                "Channel no longer exists"));

        return Map.of(
            "channel_id", channel.getId(),
            "channel_name", channel.getName(),
            "channel_description", channel.getDescription() != null ? channel.getDescription() : "",
            "member_count", channel.getMembers().size(),
            "expires_at", invite.getExpiresAt() != null ? invite.getExpiresAt() : "",
            "use_count", invite.getUseCount(),
            "max_uses", invite.getMaxUses() != null ? invite.getMaxUses() : 0
        );
    }

    // ─── Join via invite ───────────────────────────────────────────────────────

    public Map<String, Object> joinViaInvite(String token, String userId) {
        InviteLink invite = inviteLinkRepository.findByTokenAndActive(token)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                "Invite link not found or revoked"));

        validateInvite(invite, token);

        Channel channel = channelRepository.findByChannelId(invite.getChannelId())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                "Channel no longer exists"));

        if (channel.getMembers().contains(userId)) {
            return Map.of("success", true, "channel_id", channel.getId(),
                "channel_name", channel.getName(), "already_member", true);
        }

        channel.getMembers().add(userId);
        channelRepository.save(channel);

        invite.setUseCount(invite.getUseCount() + 1);
        inviteLinkRepository.save(invite);

        wsPublisher.publishToChannel(channel.getId(), Map.of(
            "type", "channel_updated",
            "channel_id", channel.getId(),
            "action", "member_added",
            "user_id", userId
        ));

        return Map.of("success", true, "channel_id", channel.getId(),
            "channel_name", channel.getName(), "already_member", false);
    }

    // ─── List invites ──────────────────────────────────────────────────────────

    public List<InviteLink> listInvites(String channelId, String userId) {
        getChannelForMember(channelId, userId);
        return inviteLinkRepository.findActiveByChannelId(channelId);
    }

    // ─── Revoke ────────────────────────────────────────────────────────────────

    public void revokeInvite(String inviteId, String userId) {
        InviteLink invite = inviteLinkRepository.findByInviteId(inviteId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Invite not found"));
        getChannelForMember(invite.getChannelId(), userId);
        invite.setActive(false);
        inviteLinkRepository.save(invite);
    }

    // ─── Internal ─────────────────────────────────────────────────────────────

    private void validateInvite(InviteLink invite, String token) {
        if (!verifyToken(token, invite.getChannelId(), invite.getId(), invite.getCreatedAt())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid invite token");
        }
        if (invite.getExpiresAt() != null && Instant.parse(invite.getExpiresAt()).isBefore(Instant.now())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "This invite link has expired");
        }
        if (invite.getMaxUses() != null && invite.getUseCount() >= invite.getMaxUses()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                "This invite link has reached its maximum uses");
        }
    }

    private Channel getChannelForMember(String channelId, String userId) {
        Channel ch = channelRepository.findByChannelId(channelId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Channel not found"));
        if (!ch.getMembers().contains(userId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied");
        }
        return ch;
    }

    private String generateToken(String channelId, String inviteId, String createdAt) {
        try {
            String message = channelId + ":" + inviteId + ":" + createdAt;
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            byte[] sig = mac.doFinal(message.getBytes(StandardCharsets.UTF_8));
            return Base64.getUrlEncoder().withoutPadding().encodeToString(sig);
        } catch (Exception e) {
            throw new RuntimeException("HMAC generation failed", e);
        }
    }

    private boolean verifyToken(String token, String channelId, String inviteId, String createdAt) {
        String expected = generateToken(channelId, inviteId, createdAt);
        // Timing-safe comparison
        if (expected.length() != token.length()) return false;
        int diff = 0;
        for (int i = 0; i < expected.length(); i++) {
            diff |= expected.charAt(i) ^ token.charAt(i);
        }
        return diff == 0;
    }
}
