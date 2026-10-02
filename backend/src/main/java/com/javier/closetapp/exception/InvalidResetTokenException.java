package com.javier.closetapp.exception;

// Thrown for any unusable password reset token - unknown, expired, already
// used, or belonging to a deactivated account. One message for all of them so
// the response doesn't hint at which case it was.
public class InvalidResetTokenException extends RuntimeException {

    public InvalidResetTokenException() {
        super("This password reset link is invalid or has expired.");
    }
}
