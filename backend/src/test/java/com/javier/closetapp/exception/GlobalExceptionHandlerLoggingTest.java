package com.javier.closetapp.exception;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

// Audit M25: what the log gets for an unexpected error names the types and the place, never the messages.
class GlobalExceptionHandlerLoggingTest {

    @Test
    @DisplayName("the description carries the exception types and frames but not the message or the cause's message")
    void describeHasNoMessages() {
        RuntimeException cause = new IllegalStateException("Key (email)=(ana@example.com) already exists");
        RuntimeException error = new RuntimeException("could not execute statement for ana@example.com", cause);

        String described = GlobalExceptionHandler.describe(error);

        assertTrue(described.contains("java.lang.RuntimeException"));
        assertTrue(described.contains("IllegalStateException"));
        assertTrue(described.contains("GlobalExceptionHandlerLoggingTest"));
        assertFalse(described.contains("ana@example.com"));
        assertFalse(described.contains("already exists"));
    }
}
