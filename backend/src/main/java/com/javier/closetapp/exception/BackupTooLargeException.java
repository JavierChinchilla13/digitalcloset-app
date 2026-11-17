package com.javier.closetapp.exception;

// The backup would be bigger than the hard cap of the in-app download. Mapped to HTTP 413 by GlobalExceptionHandler. Unchecked so it
// passes straight through the stream wrappers that build the archive.
public class BackupTooLargeException extends RuntimeException {
    public BackupTooLargeException(String message) {
        super(message);
    }
}
