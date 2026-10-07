package com.javier.closetapp.exception;

// A Google sign-in that cannot go ahead (Task 98): the token is not valid (401), the Google email is not
// verified or the account is deactivated (401 / 403), or Google sign-in is not set up here (400). Carries
// its own HTTP status; GlobalExceptionHandler answers with it and a message safe to show.
public class GoogleSignInException extends RuntimeException {

    private final int status;

    public GoogleSignInException(String message, int status) {
        super(message);
        this.status = status;
    }

    public int getStatus() {
        return status;
    }
}
