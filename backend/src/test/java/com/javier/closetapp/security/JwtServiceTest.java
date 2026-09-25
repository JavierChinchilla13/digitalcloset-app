package com.javier.closetapp.security;

import io.jsonwebtoken.ExpiredJwtException;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.security.SignatureException;
import io.jsonwebtoken.security.WeakKeyException;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.test.util.ReflectionTestUtils;

import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

// Blueprint Phase 5, area 2: JWT - generation, validation, expiration and
// secret handling. Plain unit tests: JwtService only needs its two @Value
// fields, which are set directly, so no Spring context is started.
class JwtServiceTest {

    // Base64 of 48 arbitrary bytes (384 bits) - a valid HS256 key. Test-only.
    private static final String SECRET = b64("unit-test-secret-key-that-is-long-enough-0123456789");
    private static final String OTHER_SECRET = b64("a-completely-different-secret-key-for-negative-tests-99");

    private static String b64(String raw) {
        return Base64.getEncoder().encodeToString(raw.getBytes(StandardCharsets.UTF_8));
    }

    private JwtService serviceWith(String secret, long expirationMs) {
        JwtService service = new JwtService();
        ReflectionTestUtils.setField(service, "secretKey", secret);
        ReflectionTestUtils.setField(service, "jwtExpiration", expirationMs);
        return service;
    }

    private UserDetails user(String email) {
        return new User(email, "irrelevant", List.of());
    }

    // ---- generation ----

    @Test
    @DisplayName("a generated token carries the user's email as its subject")
    void generatedTokenHasSubject() {
        JwtService service = serviceWith(SECRET, 60_000);

        String token = service.generateToken(user("a@example.com"));

        assertEquals("a@example.com", service.extractUsername(token));
        assertEquals(3, token.split("\\.").length, "a JWT has header.payload.signature");
    }

    @Test
    @DisplayName("extra claims are embedded in the token")
    void extraClaimsAreEmbedded() {
        JwtService service = serviceWith(SECRET, 60_000);

        String token = service.generateToken(Map.of("tier", "gold"), user("a@example.com"));

        assertEquals("gold", service.extractClaim(token, claims -> claims.get("tier", String.class)));
    }

    // ---- validation ----

    @Test
    @DisplayName("a fresh token is valid for its own user")
    void freshTokenIsValid() {
        JwtService service = serviceWith(SECRET, 60_000);
        UserDetails alice = user("alice@example.com");

        assertTrue(service.isTokenValid(service.generateToken(alice), alice));
    }

    @Test
    @DisplayName("a token is not valid for a different user")
    void tokenIsNotValidForAnotherUser() {
        JwtService service = serviceWith(SECRET, 60_000);
        String aliceToken = service.generateToken(user("alice@example.com"));

        assertFalse(service.isTokenValid(aliceToken, user("bob@example.com")));
    }

    @Test
    @DisplayName("a token whose payload was altered is rejected (signature check)")
    void tamperedPayloadIsRejected() {
        JwtService service = serviceWith(SECRET, 60_000);
        String[] parts = service.generateToken(user("alice@example.com")).split("\\.");
        String forgedPayload = Base64.getUrlEncoder().withoutPadding()
                .encodeToString("{\"sub\":\"admin@example.com\",\"exp\":9999999999}".getBytes(StandardCharsets.UTF_8));

        String forged = parts[0] + "." + forgedPayload + "." + parts[2];

        assertThrows(SignatureException.class, () -> service.extractUsername(forged));
    }

    @Test
    @DisplayName("a token signed with a different secret is rejected")
    void tokenFromAnotherSecretIsRejected() {
        String foreign = serviceWith(OTHER_SECRET, 60_000).generateToken(user("alice@example.com"));

        assertThrows(SignatureException.class, () -> serviceWith(SECRET, 60_000).extractUsername(foreign));
    }

    @Test
    @DisplayName("garbage and unsigned tokens are rejected")
    void malformedTokensAreRejected() {
        JwtService service = serviceWith(SECRET, 60_000);

        assertThrows(JwtException.class, () -> service.extractUsername("not-a-jwt"));
        // alg=none token: header {"alg":"none"}, payload {"sub":"admin"}, no signature
        String unsigned = "eyJhbGciOiJub25lIn0.eyJzdWIiOiJhZG1pbiJ9.";
        assertThrows(JwtException.class, () -> service.extractUsername(unsigned));
    }

    // ---- expiration ----

    @Test
    @DisplayName("an expired token is rejected")
    void expiredTokenIsRejected() {
        JwtService service = serviceWith(SECRET, -1_000);
        UserDetails alice = user("alice@example.com");
        String expired = service.generateToken(alice);

        assertThrows(ExpiredJwtException.class, () -> service.isTokenValid(expired, alice));
    }

    @Test
    @DisplayName("the configured lifetime is what ends up in the token")
    void expirationFollowsConfiguration() {
        JwtService service = serviceWith(SECRET, 3_600_000);
        long before = System.currentTimeMillis();

        String token = service.generateToken(user("alice@example.com"));

        long exp = service.extractClaim(token, claims -> claims.getExpiration().getTime());
        long lifetime = exp - before;
        // JWT timestamps are whole seconds, so allow a couple of seconds of slack.
        assertTrue(lifetime > 3_590_000 && lifetime < 3_610_000, "lifetime was " + lifetime + "ms");
    }

    // ---- secret handling ----

    @Test
    @DisplayName("a secret that is not valid Base64 is refused, not silently used")
    void nonBase64SecretIsRefused() {
        JwtService service = serviceWith("this is definitely !!! not base64", 60_000);

        assertThrows(RuntimeException.class, () -> service.generateToken(user("a@example.com")));
    }

    @Test
    @DisplayName("a secret shorter than 256 bits is refused")
    void weakSecretIsRefused() {
        JwtService service = serviceWith(b64("short"), 60_000);

        assertThrows(WeakKeyException.class, () -> service.generateToken(user("a@example.com")));
    }

    @Test
    @DisplayName("two different secrets never produce the same token")
    void differentSecretsGiveDifferentTokens() {
        UserDetails alice = user("alice@example.com");

        String a = serviceWith(SECRET, 60_000).generateToken(alice);
        String b = serviceWith(OTHER_SECRET, 60_000).generateToken(alice);

        assertNotEquals(a.split("\\.")[2], b.split("\\.")[2]);
    }
}
