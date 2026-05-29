package com.chathub.repository;

import com.chathub.model.RefreshToken;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;

import java.util.List;
import java.util.Optional;

public interface RefreshTokenRepository extends MongoRepository<RefreshToken, String> {

    @Query("{ 'tokenHash': ?0, 'revoked': false }")
    Optional<RefreshToken> findActiveByTokenHash(String tokenHash);

    @Query("{ 'userId': ?0, 'revoked': false }")
    List<RefreshToken> findActiveByUserId(String userId);

    @Query(value = "{ 'userId': ?0 }", delete = false)
    void revokeAllForUser(String userId);
}
