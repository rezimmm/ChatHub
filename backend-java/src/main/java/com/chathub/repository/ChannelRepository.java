package com.chathub.repository;

import com.chathub.model.Channel;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;

import java.util.List;
import java.util.Optional;

public interface ChannelRepository extends MongoRepository<Channel, String> {
    @Query("{ 'id': ?0 }")
    Optional<Channel> findByChannelId(String id);

    @Query("{ 'members': ?0 }")
    List<Channel> findByMembersContaining(String userId);

    @Query("{ 'name': ?0 }")
    Optional<Channel> findByName(String name);
}
