package com.javier.closetapp.auth.google;

import com.javier.closetapp.exception.GoogleSignInException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidatorResult;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.stereotype.Component;

import java.util.List;

// The real verifier: Google signs its ID tokens (RS256) with keys it publishes at a fixed address, so the
// token is checked offline against those keys - no secret is needed. Besides the signature it must be
//  - not expired,
//  - issued by Google (iss is accounts.google.com or https://accounts.google.com), and
//  - meant for THIS app (aud contains our client id). Without this check a token Google issued to some
//    other site's "Sign in with Google" button would sign people in here.
// The decoder fetches and caches Google's keys the first time a token arrives, not at startup.
@Component
public class NimbusGoogleTokenVerifier implements GoogleTokenVerifier {

    private static final Logger log = LoggerFactory.getLogger(NimbusGoogleTokenVerifier.class);

    static final String JWKS_URI = "https://www.googleapis.com/oauth2/v3/certs";
    private static final List<String> ISSUERS = List.of("accounts.google.com", "https://accounts.google.com");

    private final String clientId;
    private final JwtDecoder decoder;

    @Autowired
    public NimbusGoogleTokenVerifier(@Value("${app.google.client-id:}") String clientId) {
        this(clientId, buildDecoder(clientId));
    }

    // For tests: a decoder with keys of their own instead of Google's.
    NimbusGoogleTokenVerifier(String clientId, JwtDecoder decoder) {
        this.clientId = clientId == null ? "" : clientId.trim();
        this.decoder = decoder;
    }

    private static JwtDecoder buildDecoder(String clientId) {
        NimbusJwtDecoder decoder = NimbusJwtDecoder.withJwkSetUri(JWKS_URI).build();
        decoder.setJwtValidator(validator(clientId));
        return decoder;
    }

    // Expiry (with Spring's default 60 s clock allowance) + issuer + audience.
    static OAuth2TokenValidator<Jwt> validator(String clientId) {
        OAuth2TokenValidator<Jwt> issuer = jwt -> ISSUERS.contains(jwt.getClaimAsString("iss"))
                ? OAuth2TokenValidatorResult.success()
                : OAuth2TokenValidatorResult.failure(new OAuth2Error("invalid_token", "Not issued by Google", null));
        OAuth2TokenValidator<Jwt> audience = jwt -> jwt.getAudience() != null && jwt.getAudience().contains(clientId)
                ? OAuth2TokenValidatorResult.success()
                : OAuth2TokenValidatorResult.failure(new OAuth2Error("invalid_token", "Not meant for this app", null));
        return new org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator<>(
                JwtValidators.createDefault(), issuer, audience);
    }

    @Override
    public boolean isConfigured() {
        return !clientId.isEmpty();
    }

    @Override
    public GoogleIdentity verify(String credential) {
        if (!isConfigured()) {
            throw new GoogleSignInException("Google sign-in is not set up on this server.", 400);
        }
        Jwt jwt;
        try {
            jwt = decoder.decode(credential);
        } catch (JwtException e) {
            // Includes "could not fetch Google's keys". Logged without the token itself.
            log.warn("Google sign-in token rejected: {}", e.getMessage());
            throw new GoogleSignInException("Google sign-in failed. Please try again.", 401);
        }

        String subject = jwt.getSubject();
        String email = jwt.getClaimAsString("email");
        if (subject == null || subject.isBlank() || email == null || email.isBlank()) {
            throw new GoogleSignInException("Google did not share an email address.", 401);
        }
        Object verified = jwt.getClaim("email_verified");
        boolean emailVerified = Boolean.TRUE.equals(verified) || "true".equals(verified);
        return new GoogleIdentity(subject, email.trim(), emailVerified, jwt.getClaimAsString("given_name"), jwt.getClaimAsString("family_name"));
    }
}
