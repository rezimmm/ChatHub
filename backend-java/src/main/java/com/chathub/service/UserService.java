package com.chathub.service;

import com.chathub.dto.UserResponse;
import com.chathub.model.User;
import com.chathub.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;

    public User getCurrentUser(String userId) {
        return userRepository.findByUserId(userId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
    }

    public List<UserResponse> getAllUsers() {
        return userRepository.findAll().stream()
            .map(UserResponse::from)
            .collect(Collectors.toList());
    }

    public User updateUser(String userId, String username, String status, String bio, String avatarUrl) {
        User user = getCurrentUser(userId);

        if (username != null && !username.isBlank()) {
            username = sanitize(username.strip());
            if (username.length() < 2 || username.length() > 30) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Username must be 2–30 characters");
            }
            user.setUsername(username);
        }
        if (status != null) user.setStatus(sanitize(status));
        if (bio != null) user.setBio(sanitize(bio));
        if (avatarUrl != null) user.setAvatarUrl(avatarUrl);

        return userRepository.save(user);
    }

    public void setOnline(String userId, boolean online) {
        userRepository.findByUserId(userId).ifPresent(user -> {
            user.setOnline(online);
            user.setLastSeen(Instant.now().toString());
            userRepository.save(user);
        });
    }

    public void deleteAccount(String userId) {
        userRepository.findByUserId(userId).ifPresent(userRepository::delete);
    }

    private String sanitize(String input) {
        if (input == null) return "";
        return input.replace("<", "&lt;").replace(">", "&gt;");
    }
}
