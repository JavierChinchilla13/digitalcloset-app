package com.javier.closetapp.auth.google;

import com.javier.closetapp.exception.GoogleSignInException;
import com.nimbusds.jose.JOSEException;
import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.JWSHeader;
import com.nimbusds.jose.crypto.RSASSASigner;
import com.nimbusds.jose.jwk.RSAKey;
import com.nimbusds.jose.jwk.gen.RSAKeyGenerator;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;

import java.time.Instant;
import java.util.Date;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

// Task 98: the checks a Google ID token must pass. Tokens are signed here with a key of the test's own
// and the verifier is given that key instead of Google's, so the real validation (signature, issuer,
// audience, expiry, claims) runs without any network.
class NimbusGoogleTokenVerifierTest {

    private static final String CLIENT_ID = "my-app.apps.googleusercontent.com";

    private static RSAKey googleKey;
    private static RSAKey strangerKey;
    private static NimbusGoogleTokenVerifier verifier;

    @BeforeAll
    static void keys() throws JOSEException {
        googleKey = new RSAKeyGenerator(2048).keyID("g1").generate();
        strangerKey = new RSAKeyGenerator(2048).keyID("g1").generate(); // same key id, different key
        NimbusJwtDecoder decoder = NimbusJwtDecoder.withPublicKey(googleKey.toRSAPublicKey()).build();
        decoder.setJwtValidator(NimbusGoogleTokenVerifier.validator(CLIENT_ID));
        verifier = new NimbusGoogleTokenVerifier(CLIENT_ID, decoder);
    }

    private static JWTClaimsSet.Builder goodClaims() {
        return new JWTClaimsSet.Builder()
                .issuer("https://accounts.google.com")
                .audience(CLIENT_ID)
                .subject("1234567890")
                .claim("email", "ada@example.com")
                .claim("email_verified", true)
                .claim("given_name", "Ada")
                .claim("family_name", "Lovelace")
                .issueTime(Date.from(Instant.now()))
                .expirationTime(Date.from(Instant.now().plusSeconds(3600)));
    }

    private static String sign(JWTClaimsSet claims, RSAKey key) throws JOSEException {
        SignedJWT jwt = new SignedJWT(new JWSHeader.Builder(JWSAlgorithm.RS256).keyID(key.getKeyID()).build(), claims);
        jwt.sign(new RSASSASigner(key));
        return jwt.serialize();
    }

    private static void assertRejected(String token) {
        GoogleSignInException e = assertThrows(GoogleSignInException.class, () -> verifier.verify(token));
        assertEquals(401, e.getStatus());
    }

    @Test
    @DisplayName("a genuine token for this app gives the person's identity")
    void validToken() throws Exception {
        GoogleIdentity id = verifier.verify(sign(goodClaims().build(), googleKey));

        assertEquals("1234567890", id.subject());
        assertEquals("ada@example.com", id.email());
        assertTrue(id.emailVerified());
        assertEquals("Ada", id.givenName());
        assertEquals("Lovelace", id.familyName());
    }

    @Test
    @DisplayName("both spellings of Google's issuer are accepted")
    void bothIssuers() throws Exception {
        verifier.verify(sign(goodClaims().issuer("accounts.google.com").build(), googleKey));
        verifier.verify(sign(goodClaims().issuer("https://accounts.google.com").build(), googleKey));
    }

    @Test
    @DisplayName("a token Google issued to a different app is refused (wrong audience)")
    void wrongAudience() throws Exception {
        assertRejected(sign(goodClaims().audience("someone-elses-app.apps.googleusercontent.com").build(), googleKey));
    }

    @Test
    @DisplayName("a token from another issuer is refused")
    void wrongIssuer() throws Exception {
        assertRejected(sign(goodClaims().issuer("https://evil.example.com").build(), googleKey));
    }

    @Test
    @DisplayName("an expired token is refused")
    void expired() throws Exception {
        assertRejected(sign(goodClaims().expirationTime(Date.from(Instant.now().minusSeconds(600))).build(), googleKey));
    }

    @Test
    @DisplayName("a token signed with some other key is refused")
    void badSignature() throws Exception {
        assertRejected(sign(goodClaims().build(), strangerKey));
    }

    @Test
    @DisplayName("garbage and an unsigned token are refused")
    void garbage() throws Exception {
        assertRejected("not-a-token");
        assertRejected("");
        // alg "none": header {"alg":"none"} + claims, no signature.
        String none = java.util.Base64.getUrlEncoder().withoutPadding().encodeToString("{\"alg\":\"none\"}".getBytes())
                + "." + java.util.Base64.getUrlEncoder().withoutPadding().encodeToString(goodClaims().build().toString().getBytes()) + ".";
        assertRejected(none);
    }

    @Test
    @DisplayName("a token without an email is refused")
    void noEmail() throws Exception {
        assertRejected(sign(goodClaims().claim("email", null).build(), googleKey));
    }

    @Test
    @DisplayName("email_verified can be a string; false is reported as unverified")
    void emailVerifiedForms() throws Exception {
        assertTrue(verifier.verify(sign(goodClaims().claim("email_verified", "true").build(), googleKey)).emailVerified());
        assertFalse(verifier.verify(sign(goodClaims().claim("email_verified", false).build(), googleKey)).emailVerified());
        assertFalse(verifier.verify(sign(goodClaims().claim("email_verified", null).build(), googleKey)).emailVerified());
    }

    @Test
    @DisplayName("with no client id configured, Google sign-in is off (400), whatever the token")
    void notConfigured() throws Exception {
        NimbusJwtDecoder decoder = NimbusJwtDecoder.withPublicKey(googleKey.toRSAPublicKey()).build();
        NimbusGoogleTokenVerifier off = new NimbusGoogleTokenVerifier("", decoder);

        assertFalse(off.isConfigured());
        GoogleSignInException e = assertThrows(GoogleSignInException.class, () -> off.verify(sign(goodClaims().build(), googleKey)));
        assertEquals(400, e.getStatus());
        assertTrue(verifier.isConfigured());
    }
}
