package com.javier.closetapp.exception;

// Thrown when a requested resource (clothing item, outfit, etc.) doesn't exist
// or isn't visible to the caller. Mapped to HTTP 404 by GlobalExceptionHandler.
public class ResourceNotFoundException extends RuntimeException {
    public ResourceNotFoundException(String message) {
        super(message);
    }
}
