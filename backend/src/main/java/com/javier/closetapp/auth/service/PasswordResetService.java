package com.javier.closetapp.auth.service;

import com.javier.closetapp.auth.entity.PasswordResetToken;
import com.javier.closetapp.auth.mail.PasswordResetMailer;
import com.javier.closetapp.auth.repository.PasswordResetTokenRepository;
import com.javier.closetapp.exception.InvalidResetTokenException;
import com.javier.closetapp.user.entity.User;
import com.javier.closetapp.user.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Optional;

// Password reset (Task 21): request a link by email, then use it once to set a
// new password. Design points:
//  - The raw token only ever exists in the emailed link; the database holds a
//    SHA-256 hash, so a leaked table can't be turned into working links.
//  - requestReset() never reveals whether an email has an account: it does the
//    same thing (return quietly) for unknown, deactivated, throttled and
//    mail-failure cases.
//  - Tokens expire and are single-use; issuing a new one invalidates the old.
//  - Known limit: JWTs are stateless, so sessions already issued before a
//    reset stay valid until they expire on their own.
@Service
public class PasswordResetService {

    private static final Logger log = LoggerFactory.getLogger(PasswordResetService.class);
    private static final SecureRandom RANDOM = new SecureRandom();

    private final UserRepository userRepository;
    private final PasswordResetTokenRepository tokenRepository;
    private final PasswordEncoder passwordEncoder;
    private final PasswordResetMailer mailer;

    private final long expirationMinutes;
    private final long minIntervalSeconds;
    private final String frontendUrl;

    public PasswordResetService(UserRepository userRepository,
                                PasswordResetTokenRepository tokenRepository,
                                PasswordEncoder passwordEncoder,
                                PasswordResetMailer mailer,
                                @Value("${app.password-reset.expiration-minutes:30}") long expirationMinutes,
                                @Value("${app.password-reset.min-interval-seconds:60}") long minIntervalSeconds,
                                @Value("${app.frontend-url}") String frontendUrl) {
        this.userRepository = userRepository;
        this.tokenRepository = tokenRepository;
        this.passwordEncoder = passwordEncoder;
        this.mailer = mailer;
        this.expirationMinutes = expirationMinutes;
        this.minIntervalSeconds = minIntervalSeconds;
        this.frontendUrl = frontendUrl;
    }

    @Transactional
    public void requestReset(String email) {
        Optional<User> found = userRepository.findByEmail(email == null ? "" : email.trim());
        if (found.isEmpty() || !found.get().isActive()) {
            return;
        }
        User user = found.get();

        // Cheap abuse guard: don't mail (or churn tokens) more than once per
        // interval for the same account.
        Optional<PasswordResetToken> latest = tokenRepository.findFirstByUser_UserIdOrderByCreatedAtDesc(user.getUserId());
        if (latest.isPresent() && latest.get().getCreatedAt().isAfter(LocalDateTime.now().minusSeconds(minIntervalSeconds))) {
            return;
        }

        tokenRepository.deleteAllByUserId(user.getUserId());

        String rawToken = generateToken();
        tokenRepository.save(new PasswordResetToken(user, hash(rawToken), LocalDateTime.now().plusMinutes(expirationMinutes)));

        String link = frontendUrl.replaceAll("/+$", "") + "/reset-password?token=" + rawToken;
        try {
            mailer.sendPasswordResetLink(user.getEmail(), link);
        } catch (RuntimeException ex) {
            // Swallowed on purpose: surfacing a mail failure would tell the
            // caller the account exists. Logged so it isn't silent.
            log.error("Could not send password reset email", ex);
        }
    }

    @Transactional
    public void resetPassword(String rawToken, String newPassword) {
        PasswordResetToken token = tokenRepository.findByTokenHash(hash(rawToken == null ? "" : rawToken))
                .orElseThrow(InvalidResetTokenException::new);

        User user = token.getUser();
        if (token.getUsedAt() != null || token.getExpiresAt().isBefore(LocalDateTime.now()) || !user.isActive()) {
            throw new InvalidResetTokenException();
        }

        user.setPassword(passwordEncoder.encode(newPassword));
        userRepository.save(user);

        // Single use: remove this and any other outstanding tokens for the user.
        tokenRepository.deleteAllByUserId(user.getUserId());
    }

    private static String generateToken() {
        byte[] bytes = new byte[32];
        RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private static String hash(String rawToken) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(rawToken.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 is unavailable", e);
        }
    }
}
