package com.javier.closetapp.auth.service;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;

@Repository
public interface ReauthFailureRepository extends JpaRepository<ReauthFailure, Long> {

    long countByUserIdAndFailedAtAfter(Long userId, LocalDateTime since);

    void deleteByUserId(Long userId);

    void deleteByFailedAtBefore(LocalDateTime cutoff);
}
