package com.javier.closetapp.auth.entity;

import com.javier.closetapp.user.entity.User;
import jakarta.persistence.*;

import java.time.LocalDateTime;

// A single-use, expiring password reset token. Only the SHA-256 hash of the
// token is stored (see PasswordResetService) - the raw token exists only in the
// emailed link.
@Entity
@Table(name = "password_reset_tokens")
public class PasswordResetToken {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "token_id")
    private Long tokenId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "token_hash", nullable = false, unique = true, length = 64)
    private String tokenHash;

    @Column(name = "expires_at", nullable = false)
    private LocalDateTime expiresAt;

    @Column(name = "used_at")
    private LocalDateTime usedAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    public PasswordResetToken() {}

    public PasswordResetToken(User user, String tokenHash, LocalDateTime expiresAt) {
        this.user = user;
        this.tokenHash = tokenHash;
        this.expiresAt = expiresAt;
        this.createdAt = LocalDateTime.now();
    }

    public Long getTokenId() { return tokenId; }

    public User getUser() { return user; }

    public String getTokenHash() { return tokenHash; }

    public LocalDateTime getExpiresAt() { return expiresAt; }

    public LocalDateTime getUsedAt() { return usedAt; }

    public void setUsedAt(LocalDateTime usedAt) { this.usedAt = usedAt; }

    public LocalDateTime getCreatedAt() { return createdAt; }
}
