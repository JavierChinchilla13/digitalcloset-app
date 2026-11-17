package com.javier.closetapp.auth.service;

import com.javier.closetapp.auth.google.GoogleIdentity;
import com.javier.closetapp.auth.google.GoogleTokenVerifier;
import com.javier.closetapp.exception.ForbiddenOperationException;
import com.javier.closetapp.exception.GoogleSignInException;
import com.javier.closetapp.exception.TooManyRequestsException;
import com.javier.closetapp.user.entity.User;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.ZoneOffset;

// Proof that the person at the keyboard is the account's owner, for actions that must not rest on a stolen session alone ("delete my
// account", "download a backup", changing the password or the email): the account's password, or, for an account that has no password
// (Google only), a fresh Google credential for the same Google account. A wrong proof is 403 (not 401: the website signs people out on 401).
//
// Wrong proofs are COUNTED PER ACCOUNT in the database (ReauthFailureLog), shared by every action that asks for one: after
// `maxFailures` wrong ones inside `windowMinutes` the account gets 429 for these actions, even with the right password, until the window
// passes. A right proof clears the count. This stops someone holding a stolen session from guessing the password through these endpoints
// (and a restart or a second server cannot reset it). Signing in itself has its own limits.
@Service
public class ReauthenticationService {

    private static final Logger log = LoggerFactory.getLogger(ReauthenticationService.class);

    private final PasswordEncoder passwordEncoder;
    private final GoogleTokenVerifier googleTokenVerifier;
    private final ReauthFailureLog failures;
    private final int maxFailures;
    private final long windowMinutes;

    public ReauthenticationService(PasswordEncoder passwordEncoder, GoogleTokenVerifier googleTokenVerifier, ReauthFailureLog failures,
                                   @Value("${app.reauth.max-failures:5}") int maxFailures,
                                   @Value("${app.reauth.window-minutes:15}") long windowMinutes) {
        this.passwordEncoder = passwordEncoder;
        this.googleTokenVerifier = googleTokenVerifier;
        this.failures = failures;
        this.maxFailures = maxFailures;
        this.windowMinutes = windowMinutes;
    }

    // Password for an account that has one, otherwise a fresh Google credential.
    public void requireProof(User user, String password, String googleCredential) {
        throttle(user);
        try {
            if (user.getPassword() != null) {
                checkPassword(user, password);
            } else {
                requireFreshGoogleProof(user, googleCredential);
            }
        } catch (ForbiddenOperationException wrong) {
            failures.recordFailure(user.getUserId());
            throw wrong;
        }
        failures.clear(user.getUserId());
    }

    // For the actions that only ever take a password (password change, email change). The caller has already dealt with an account that has none.
    public void requirePassword(User user, String password) {
        throttle(user);
        try {
            checkPassword(user, password);
        } catch (ForbiddenOperationException wrong) {
            failures.recordFailure(user.getUserId());
            throw wrong;
        }
        failures.clear(user.getUserId());
    }

    private void throttle(User user) {
        LocalDateTime since = LocalDateTime.now(ZoneOffset.UTC).minusMinutes(windowMinutes);
        if (failures.failuresSince(user.getUserId(), since) >= maxFailures) {
            log.warn("Too many wrong re-authentication attempts for user id {}", user.getUserId());
            throw new TooManyRequestsException("Too many incorrect attempts. Please try again in a few minutes.");
        }
    }

    private void checkPassword(User user, String password) {
        if (password == null || !passwordEncoder.matches(password, user.getPassword())) {
            throw new ForbiddenOperationException("Current password is incorrect");
        }
    }

    // For an account with no password: the Google credential must be valid and belong to the same Google account.
    private void requireFreshGoogleProof(User user, String credential) {
        String message = "Google could not confirm it is you. Please try again.";
        if (credential == null || credential.isBlank() || user.getGoogleId() == null) {
            throw new ForbiddenOperationException(message);
        }
        GoogleIdentity identity;
        try {
            identity = googleTokenVerifier.verify(credential);
        } catch (GoogleSignInException e) {
            throw new ForbiddenOperationException(message);
        }
        if (!user.getGoogleId().equals(identity.subject())) {
            throw new ForbiddenOperationException(message);
        }
    }
}
