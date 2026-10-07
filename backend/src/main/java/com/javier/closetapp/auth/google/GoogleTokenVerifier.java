package com.javier.closetapp.auth.google;

// Checks the "credential" (a Google ID token) the browser got from Google's sign-in button and says
// who it belongs to (Task 98). An interface so the tests can stand in a fake that needs no network.
public interface GoogleTokenVerifier {

    // Whether Google sign-in is set up on this server (a Google client id is configured).
    boolean isConfigured();

    // The identity inside a valid token. Throws GoogleSignInException (401) for a token that is not
    // genuine, not meant for this app, expired, or malformed - and a 400 one when sign-in is not set up.
    GoogleIdentity verify(String credential);
}
