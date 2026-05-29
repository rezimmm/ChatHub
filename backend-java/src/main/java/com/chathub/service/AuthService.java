package com.chathub.service;

import com.chathub.config.AppProperties;
import com.chathub.dto.TokenResponse;
import com.chathub.dto.UserResponse;
import com.chathub.model.RefreshToken;
import com.chathub.model.User;
import com.chathub.repository.RefreshTokenRepository;
import com.chathub.repository.UserRepository;
import com.chathub.security.JwtUtil;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;
import java.util.Random;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final JwtUtil jwtUtil;
    private final PasswordEncoder passwordEncoder;
    private final AppProperties appProperties;
    private final UnreadCountService unreadCountService;
    private final ChannelService channelService;

    private static final List<String> AVATAR_COLORS = List.of(
        "#7c3aed", "#0d9488", "#ec4899", "#f59e0b", "#3b82f6", "#ef4444"
    );
    private static final List<String> AVATAR_URLS = List.of(
        "https://images.unsplash.com/photo-1650913406617-bd9b0ab07d07?w=200&h=200&fit=crop",
        "https://images.unsplash.com/photo-1771050889377-b68415885c64?w=200&h=200&fit=crop",
        "https://images.unsplash.com/photo-1648293821367-b39c09679658?w=200&h=200&fit=crop",
        "https://images.pexels.com/photos/4565706/pexels-photo-4565706.jpeg?w=200&h=200&fit=crop",
        "https://images.pexels.com/photos/3228830/pexels-photo-3228830.jpeg?w=200&h=200&fit=crop"
    );

    // ─── Register ─────────────────────────────────────────────────────────────

    public TokenResponse register(String email, String username, String password,
                                   HttpServletResponse response, String clientIp) {
        if (userRepository.existsByEmail(email)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Email already registered");
        }
        if (userRepository.existsByUsername(username)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Username already taken");
        }

        Random rng = new Random();
        User user = User.builder()
            .email(email)
            .username(sanitize(username))
            .hashedPassword(passwordEncoder.encode(password))
            .avatarColor(AVATAR_COLORS.get(rng.nextInt(AVATAR_COLORS.size())))
            .avatarUrl(AVATAR_URLS.get(rng.nextInt(AVATAR_URLS.size())))
            .build();

        userRepository.save(user);

        // Ensure "general" channel exists and add user
        channelService.ensureGeneralChannel(user.getId());

        return issueTokens(user, response, clientIp);
    }

    // ─── Login ────────────────────────────────────────────────────────────────

    public TokenResponse login(String email, String password,
                                HttpServletResponse response, String clientIp) {
        User user = userRepository.findByEmail(email)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Incorrect email or password"));

        if (!passwordEncoder.matches(password, user.getHashedPassword())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Incorrect email or password");
        }

        return issueTokens(user, response, clientIp);
    }

    // ─── Refresh ─────────────────────────────────────────────────────────────

    public TokenResponse refresh(HttpServletRequest request, HttpServletResponse response) {
        String rawToken = extractRefreshTokenFromCookie(request);
        if (rawToken == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Refresh token missing");
        }

        String tokenHash = jwtUtil.hashRefreshToken(rawToken);
        RefreshToken storedToken = refreshTokenRepository.findActiveByTokenHash(tokenHash)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid or expired refresh token"));

        // Check expiry
        if (Instant.parse(storedToken.getExpiresAt()).isBefore(Instant.now())) {
            storedToken.setRevoked(true);
            refreshTokenRepository.save(storedToken);
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Refresh token expired");
        }

        User user = userRepository.findByUserId(storedToken.getUserId())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found"));

        // Rotate: revoke old, issue new
        storedToken.setRevoked(true);
        refreshTokenRepository.save(storedToken);

        return issueTokens(user, response, null);
    }

    // ─── Logout ───────────────────────────────────────────────────────────────

    public void logout(HttpServletRequest request, HttpServletResponse response) {
        String rawToken = extractRefreshTokenFromCookie(request);
        if (rawToken != null) {
            String tokenHash = jwtUtil.hashRefreshToken(rawToken);
            refreshTokenRepository.findActiveByTokenHash(tokenHash).ifPresent(t -> {
                t.setRevoked(true);
                refreshTokenRepository.save(t);
            });
        }
        clearRefreshCookie(response);
    }

    // ─── Change Password ──────────────────────────────────────────────────────

    public void changePassword(User user, String currentPassword, String newPassword) {
        if (!passwordEncoder.matches(currentPassword, user.getHashedPassword())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Current password is incorrect");
        }
        user.setHashedPassword(passwordEncoder.encode(newPassword));
        userRepository.save(user);

        // Revoke all refresh tokens for security
        List<RefreshToken> activeTokens = refreshTokenRepository.findActiveByUserId(user.getId());
        activeTokens.forEach(t -> t.setRevoked(true));
        refreshTokenRepository.saveAll(activeTokens);
    }

    // ─── Internal ─────────────────────────────────────────────────────────────

    private TokenResponse issueTokens(User user, HttpServletResponse response, String clientIp) {
        String accessToken = jwtUtil.generateAccessToken(user.getId());
        String rawRefreshToken = jwtUtil.generateRefreshToken();

        RefreshToken refreshToken = RefreshToken.builder()
            .userId(user.getId())
            .tokenHash(jwtUtil.hashRefreshToken(rawRefreshToken))
            .expiresAt(Instant.now().plus(jwtUtil.getRefreshTokenExpiryDays(), ChronoUnit.DAYS).toString())
            .createdFromIp(clientIp)
            .build();

        refreshTokenRepository.save(refreshToken);
        setRefreshCookie(response, rawRefreshToken);

        return TokenResponse.builder()
            .accessToken(accessToken)
            .tokenType("Bearer")
            .user(UserResponse.from(user))
            .build();
    }

    private void setRefreshCookie(HttpServletResponse response, String rawToken) {
        Cookie cookie = new Cookie("refresh_token", rawToken);
        cookie.setHttpOnly(true);
        cookie.setSecure(false); // Set to true in production with HTTPS
        cookie.setPath("/api/auth/refresh");
        cookie.setMaxAge((int) (jwtUtil.getRefreshTokenExpiryDays() * 24 * 60 * 60));
        response.addCookie(cookie);
    }

    private void clearRefreshCookie(HttpServletResponse response) {
        Cookie cookie = new Cookie("refresh_token", "");
        cookie.setHttpOnly(true);
        cookie.setPath("/api/auth/refresh");
        cookie.setMaxAge(0);
        response.addCookie(cookie);
    }

    private String extractRefreshTokenFromCookie(HttpServletRequest request) {
        if (request.getCookies() == null) return null;
        return Arrays.stream(request.getCookies())
            .filter(c -> "refresh_token".equals(c.getName()))
            .findFirst()
            .map(Cookie::getValue)
            .filter(v -> !v.isBlank())
            .orElse(null);
    }

    private String sanitize(String input) {
        if (input == null) return "";
        return input.strip()
            .replace("<", "&lt;")
            .replace(">", "&gt;");
    }
}
