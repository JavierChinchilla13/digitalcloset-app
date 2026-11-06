package com.javier.closetapp.exception;

// A request the caller can fix (for example a name that is too long). The message is written for the user, so it
// is returned as-is with a 400.
public class InvalidInputException extends RuntimeException {
    public InvalidInputException(String message) {
        super(message);
    }
}
