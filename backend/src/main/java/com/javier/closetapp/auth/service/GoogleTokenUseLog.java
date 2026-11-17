package com.javier.closetapp.auth.service;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.HexFormat;

// Remembers which Google ID tokens have been used, by fingerprint, so one token cannot be replayed for an "it is me" action.
//  - markSeen: a sign-in used this token (the sign-in itself may use it twice: the two-step sign-up sends the same token in both steps).
//  - claimForReauth: an "it is me" action wants to use it: false if it was already seen at sign-in or used for another such action.
// Each call is its own transaction (so a rolled-back request cannot "un-use" a token).
@Component
public class GoogleTokenUseLog {

    private final GoogleTokenUseRepository repository;

    public GoogleTokenUseLog(GoogleTokenUseRepository repository) {
        this.repository = repository;
    }

    // The SHA-256 of the token, hex (what is stored instead of the token).
    public static String fingerprint(String credential) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(credential.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void markSeen(String credential) {
        String hash = fingerprint(credential);
        if (repository.existsById(hash)) return;
        try {
            repository.saveAndFlush(new GoogleTokenUse(hash, LocalDateTime.now(ZoneOffset.UTC)));
        } catch (DataIntegrityViolationException alreadyThere) {
            // another request recorded it first: fine
        }
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public boolean claimForReauth(String credential) {
        String hash = fingerprint(credential);
        LocalDateTime now = LocalDateTime.now(ZoneOffset.UTC);
        repository.deleteByUsedAtBefore(now.minusDays(1));
        if (repository.existsById(hash)) return false;
        try {
            repository.saveAndFlush(new GoogleTokenUse(hash, now));
            return true;
        } catch (DataIntegrityViolationException raced) {
            return false;       // two requests with the same token at once: only one wins
        }
    }
}
