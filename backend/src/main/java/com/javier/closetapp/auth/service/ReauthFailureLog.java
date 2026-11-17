package com.javier.closetapp.auth.service;

import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.ZoneOffset;

// The persisted count of wrong "it is me" proofs. Each call is its OWN transaction (REQUIRES_NEW): the proof is usually checked inside
// a service method that then throws (403), and that rollback must not erase the failure that was just recorded.
@Component
public class ReauthFailureLog {

    private final ReauthFailureRepository repository;

    public ReauthFailureLog(ReauthFailureRepository repository) {
        this.repository = repository;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void recordFailure(long userId) {
        LocalDateTime now = LocalDateTime.now(ZoneOffset.UTC);
        repository.save(new ReauthFailure(userId, now));
        repository.deleteByFailedAtBefore(now.minusDays(1));
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW, readOnly = true)
    public long failuresSince(long userId, LocalDateTime since) {
        return repository.countByUserIdAndFailedAtAfter(userId, since);
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void clear(long userId) {
        repository.deleteByUserId(userId);
    }
}
