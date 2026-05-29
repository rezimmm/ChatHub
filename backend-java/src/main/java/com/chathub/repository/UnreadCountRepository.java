package com.chathub.repository;

import com.chathub.model.UnreadCount;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;

import java.util.List;
import java.util.Optional;

public interface UnreadCountRepository extends MongoRepository<UnreadCount, String> {

    @Query("{ 'userId': ?0, 'channelId': ?1 }")
    Optional<UnreadCount> findByUserIdAndChannelId(String userId, String channelId);

    @Query("{ 'userId': ?0 }")
    List<UnreadCount> findByUserId(String userId);

    @Query("{ 'channelId': ?0 }")
    List<UnreadCount> findByChannelId(String channelId);
}
