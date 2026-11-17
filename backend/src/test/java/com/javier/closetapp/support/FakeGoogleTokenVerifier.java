package com.javier.closetapp.support;

import com.javier.closetapp.auth.google.GoogleIdentity;
import com.javier.closetapp.auth.google.GoogleTokenVerifier;
import com.javier.closetapp.exception.GoogleSignInException;

// Task 98: stands in for Google in the integration tests, so no network or real token is needed. The
// "credential" is a plain string: "ok|<subject>|<email>|<emailVerified>|<given>|<family>|<issued-at epoch seconds>|<unique id>" is accepted
// as that identity (the unique id makes every credential a different "token", as real ones are); anything else is rejected like a bad token. (The real checks - signature, issuer,
// audience, expiry - are tested on NimbusGoogleTokenVerifier itself.)
public class FakeGoogleTokenVerifier implements GoogleTokenVerifier {

    // A token Google "issued" just now.
    public static String credential(String subject, String email, boolean emailVerified, String given, String family) {
        return credential(subject, email, emailVerified, given, family, java.time.Instant.now());
    }

    // A token issued at a chosen time (for the freshness tests).
    public static String credential(String subject, String email, boolean emailVerified, String given, String family, java.time.Instant issuedAt) {
        return "ok|" + subject + "|" + email + "|" + emailVerified + "|" + given + "|" + family + "|" + issuedAt.getEpochSecond() + "|"
                + java.util.UUID.randomUUID();
    }

    @Override
    public boolean isConfigured() {
        return true;
    }

    @Override
    public GoogleIdentity verify(String credential) {
        String[] parts = credential.split("\\|", -1);
        if (parts.length != 8 || !parts[0].equals("ok")) {
            throw new GoogleSignInException("Google sign-in failed. Please try again.", 401);
        }
        return new GoogleIdentity(parts[1], parts[2], Boolean.parseBoolean(parts[3]), parts[4], parts[5], java.time.Instant.ofEpochSecond(Long.parseLong(parts[6])));
    }
}
