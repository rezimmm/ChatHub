package com.chathub.repository;

import com.chathub.model.InviteLink;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;

import java.util.List;
import java.util.Optional;

public interface InviteLinkRepository extends MongoRepository<InviteLink, String> {
    @Query("{ 'id': ?0 }")
    Optional<InviteLink> findByInviteId(String id);

    @Query("{ 'token': ?0, 'isActive': true }")
    Optional<InviteLink> findByTokenAndActive(String token);

    @Query("{ 'channelId': ?0, 'isActive': true }")
    List<InviteLink> findActiveByChannelId(String channelId);
}
