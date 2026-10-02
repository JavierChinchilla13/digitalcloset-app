package com.javier.closetapp.user.entity;

import com.javier.closetapp.common.enums.AccountChangeType;
import jakarta.persistence.*;

import java.time.LocalDateTime;

// A staged, not-yet-applied email or password change (Task 79 follow-up),
// waiting on the emailed 6-digit code to confirm it. Only the SHA-256 hash of
// the code is stored - see PendingAccountChangeRepository / UserService.
@Entity
@Table(name = "pending_account_changes")
public class PendingAccountChange {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "change_id")
    private Long changeId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Enumerated(EnumType.STRING)
    @Column(name = "change_type", nullable = false)
    private AccountChangeType changeType;

    @Column(name = "new_email")
    private String newEmail;

    @Column(name = "new_password_hash")
    private String newPasswordHash;

    @Column(name = "code_hash", nullable = false, unique = true, length = 64)
    private String codeHash;

    @Column(name = "attempt_count", nullable = false)
    private int attemptCount = 0;

    @Column(name = "expires_at", nullable = false)
    private LocalDateTime expiresAt;

    @Column(name = "used_at")
    private LocalDateTime usedAt;

    // Not updatable=false: unlike PasswordResetToken, tests here need to
    // backdate this (setCreatedAt below) to exercise the resend-throttle
    // guard without a real wait - production code only ever sets it once,
    // at construction.
    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    public PendingAccountChange() {}

    public PendingAccountChange(User user, AccountChangeType changeType, String codeHash, LocalDateTime expiresAt) {
        this.user = user;
        this.changeType = changeType;
        this.codeHash = codeHash;
        this.expiresAt = expiresAt;
        this.createdAt = LocalDateTime.now();
    }

    public Long getChangeId() { return changeId; }

    public User getUser() { return user; }

    public AccountChangeType getChangeType() { return changeType; }

    public String getNewEmail() { return newEmail; }
    public void setNewEmail(String newEmail) { this.newEmail = newEmail; }

    public String getNewPasswordHash() { return newPasswordHash; }
    public void setNewPasswordHash(String newPasswordHash) { this.newPasswordHash = newPasswordHash; }

    public String getCodeHash() { return codeHash; }

    public int getAttemptCount() { return attemptCount; }
    public void setAttemptCount(int attemptCount) { this.attemptCount = attemptCount; }

    public LocalDateTime getExpiresAt() { return expiresAt; }
    // Only mutated in tests, to backdate a code past its expiry without a
    // real wait - normal flow only ever sets this once, at construction.
    public void setExpiresAt(LocalDateTime expiresAt) { this.expiresAt = expiresAt; }

    public LocalDateTime getUsedAt() { return usedAt; }
    public void setUsedAt(LocalDateTime usedAt) { this.usedAt = usedAt; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    // Only mutated in tests, to backdate past the resend min-interval guard
    // without a real wait.
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
