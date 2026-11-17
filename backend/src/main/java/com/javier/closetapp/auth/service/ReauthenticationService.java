package com.javier.closetapp.auth.service;

import com.javier.closetapp.auth.google.GoogleIdentity;
import com.javier.closetapp.auth.google.GoogleTokenVerifier;
import com.javier.closetapp.exception.ForbiddenOperationException;
import com.javier.closetapp.exception.GoogleSignInException;
import com.javier.closetapp.user.entity.User;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

// Proof that the person at the keyboard is the account's owner, for actions that must not rest on a stolen session alone ("delete my
// account", "download a backup"): the account's password, or, for an account that has no password (Google only), a FRESH Google
// credential for the same Google account. A wrong proof is 403 (not 401: the website signs people out on 401).
@Service
public class ReauthenticationService {

    private final PasswordEncoder passwordEncoder;
    private final GoogleTokenVerifier googleTokenVerifier;

    public ReauthenticationService(PasswordEncoder passwordEncoder, GoogleTokenVerifier googleTokenVerifier) {
        this.passwordEncoder = passwordEncoder;
        this.googleTokenVerifier = googleTokenVerifier;
    }

    public void requireProof(User user, String password, String googleCredential) {
        if (user.getPassword() != null) {
            if (password == null || !passwordEncoder.matches(password, user.getPassword())) {
                throw new ForbiddenOperationException("Current password is incorrect");
            }
        } else {
            requireFreshGoogleProof(user, googleCredential);
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
