package com.javier.closetapp.support;

import com.javier.closetapp.auth.google.GoogleIdentity;
import com.javier.closetapp.auth.google.GoogleTokenVerifier;
import com.javier.closetapp.exception.GoogleSignInException;

// Task 98: stands in for Google in the integration tests, so no network or real token is needed. The
// "credential" is a plain string: "ok|<subject>|<email>|<emailVerified>|<given>|<family>" is accepted as
// that identity; anything else is rejected like a bad token. (The real checks - signature, issuer,
// audience, expiry - are tested on NimbusGoogleTokenVerifier itself.)
public class FakeGoogleTokenVerifier implements GoogleTokenVerifier {

    public static String credential(String subject, String email, boolean emailVerified, String given, String family) {
        return "ok|" + subject + "|" + email + "|" + emailVerified + "|" + given + "|" + family;
    }

    @Override
    public boolean isConfigured() {
        return true;
    }

    @Override
    public GoogleIdentity verify(String credential) {
        String[] parts = credential.split("\\|", -1);
        if (parts.length != 6 || !parts[0].equals("ok")) {
            throw new GoogleSignInException("Google sign-in failed. Please try again.", 401);
        }
        return new GoogleIdentity(parts[1], parts[2], Boolean.parseBoolean(parts[3]), parts[4], parts[5]);
    }
}
