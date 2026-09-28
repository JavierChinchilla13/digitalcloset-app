package com.javier.closetapp.exception;

// Thrown when a register/create-user/change-email call uses an email that
// already belongs to another account. Mapped to HTTP 409 by
// GlobalExceptionHandler.
public class DuplicateEmailException extends RuntimeException {
    public DuplicateEmailException(String message) {
        super(message);
    }
}
