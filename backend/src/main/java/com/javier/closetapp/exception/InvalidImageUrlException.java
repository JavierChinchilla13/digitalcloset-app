package com.javier.closetapp.exception;

// A garment picture address that does not come from the app's own image host (audit M3). The message is
// written for the user, so it is returned as-is with a 400.
public class InvalidImageUrlException extends RuntimeException {
    public InvalidImageUrlException(String message) {
        super(message);
    }
}
