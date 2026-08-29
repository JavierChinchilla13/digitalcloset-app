package com.javier.closetapp.exception;

// Thrown when the authenticated user attempts an action on a resource they
// don't own. Mapped to HTTP 403 by GlobalExceptionHandler.
public class ForbiddenOperationException extends RuntimeException {
    public ForbiddenOperationException(String message) {
        super(message);
    }
}
