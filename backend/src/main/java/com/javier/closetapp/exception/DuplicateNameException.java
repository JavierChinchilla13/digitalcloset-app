package com.javier.closetapp.exception;

// The user already has something with this name (a category), so the second one is refused with a 409.
public class DuplicateNameException extends RuntimeException {
    public DuplicateNameException(String message) {
        super(message);
    }
}
