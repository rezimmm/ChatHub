package com.chathub.repository;

import com.chathub.model.Message;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;
import org.springframework.data.domain.Sort;

import java.util.List;
import java.util.Optional;

public interface MessageRepository extends MongoRepository<Message, String> {
    @Query("{ 'id': ?0 }")
    Optional<Message> findByMessageId(String id);

    @Query("{ 'channelId': ?0 }")
    List<Message> findByChannelId(String channelId, Sort sort);

    @Query("{ 'channelId': ?0, 'timestamp': { $lt: ?1 } }")
    List<Message> findByChannelIdBefore(String channelId, String before, Sort sort);

    @Query("{ 'threadId': ?0 }")
    List<Message> findByThreadId(String threadId, Sort sort);

    @Query("{ 'channelId': { $in: ?0 }, 'content': { $regex: ?1, $options: 'i' } }")
    List<Message> searchInChannels(List<String> channelIds, String query, Sort sort);
}
