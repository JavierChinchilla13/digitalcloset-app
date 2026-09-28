package com.javier.closetapp.exception;

// Thrown when a verification code is requested again too soon after the last
// one (Task 79 follow-up abuse guard - app.account-verification.min-interval-
// seconds). Mapped to HTTP 429 by GlobalExceptionHandler.
public class TooManyRequestsException extends RuntimeException {
    public TooManyRequestsException(String message) {
        super(message);
    }
}
