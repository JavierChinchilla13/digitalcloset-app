package com.javier.closetapp.exception;

// Thrown for any unusable email/password-change verification code - unknown,
// expired, already used, or over its attempt limit. One message for all of
// them, same reasoning as InvalidResetTokenException.
public class InvalidVerificationCodeException extends RuntimeException {

    public InvalidVerificationCodeException() {
        super("This code is invalid or has expired.");
    }
}
