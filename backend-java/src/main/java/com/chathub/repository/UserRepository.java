package com.chathub.repository;

import com.chathub.model.User;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;

import java.util.List;
import java.util.Optional;

public interface UserRepository extends MongoRepository<User, String> {

    @Query("{ 'email': ?0 }")
    Optional<User> findByEmail(String email);

    @Query("{ 'id': ?0 }")
    Optional<User> findByUserId(String id);

    @Query("{ 'username': ?0 }")
    Optional<User> findByUsername(String username);

    boolean existsByEmail(String email);
    boolean existsByUsername(String username);
}
