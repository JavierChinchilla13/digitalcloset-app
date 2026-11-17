package com.javier.closetapp.auth.service;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.LocalDateTime;

// The SHA-256 fingerprint of a Google ID token that has been used (see V22). Never the token itself.
@Entity
@Table(name = "google_token_uses")
public class GoogleTokenUse {

    @Id
    @Column(name = "token_hash", length = 64)
    private String tokenHash;

    @Column(name = "used_at", nullable = false)
    private LocalDateTime usedAt;

    protected GoogleTokenUse() { }

    public GoogleTokenUse(String tokenHash, LocalDateTime usedAt) {
        this.tokenHash = tokenHash;
        this.usedAt = usedAt;
    }

    public String getTokenHash() { return tokenHash; }
    public LocalDateTime getUsedAt() { return usedAt; }
}
