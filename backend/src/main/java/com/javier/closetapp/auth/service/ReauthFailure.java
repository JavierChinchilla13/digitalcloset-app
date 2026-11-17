package com.javier.closetapp.auth.service;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.LocalDateTime;

// One wrong re-authentication attempt: which account and when. Nothing else is stored (see V21).
@Entity
@Table(name = "reauth_failures")
public class ReauthFailure {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "failed_at", nullable = false)
    private LocalDateTime failedAt;

    protected ReauthFailure() { }

    public ReauthFailure(Long userId, LocalDateTime failedAt) {
        this.userId = userId;
        this.failedAt = failedAt;
    }

    public Long getId() { return id; }
    public Long getUserId() { return userId; }
    public LocalDateTime getFailedAt() { return failedAt; }
}
