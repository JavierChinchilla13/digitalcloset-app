package com.javier.closetapp.monitoring;

import com.javier.closetapp.exception.ForbiddenOperationException;
import com.javier.closetapp.exception.GlobalExceptionHandler;
import com.javier.closetapp.exception.ResourceNotFoundException;
import io.sentry.SentryEvent;
import io.sentry.protocol.SentryException;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

// Task 104: only unexpected errors are reported, nothing is sent without a DSN, and what is sent is scrubbed.
class ErrorReportingTest {

    // Records what would have been sent (a hand-made stand-in: no mocking library needed).
    private static class RecordingReporter extends ErrorReporter {
        final List<Throwable> reported = new ArrayList<>();

        RecordingReporter() {
            super("", "test");
        }

        @Override
        public void report(Throwable error) {
            reported.add(error);
        }
    }

    @Test
    @DisplayName("a blank DSN means monitoring is off and reporting does nothing")
    void offWithoutDsn() {
        ErrorReporter reporter = new ErrorReporter("", "test");
        assertFalse(reporter.isEnabled());
        reporter.report(new IllegalStateException("boom")); // must not throw
        assertFalse(new ErrorReporter("   ", "test").isEnabled());
        assertTrue(new ErrorReporter("https://key@o1.ingest.sentry.io/1", "test").isEnabled());
    }

    @Test
    @DisplayName("emails and token-like strings are removed from messages")
    void scrubbing() {
        assertEquals("Key (email)=([email]) already exists", ErrorReporter.scrubText("Key (email)=(ana.lopez@example.com) already exists"));
        assertEquals("bad token [token] here", ErrorReporter.scrubText("bad token eyJhbGciOiJIUzI1NiJ9abcdefghijklmnopqrstuvwxyz here"));
        assertEquals("plain message", ErrorReporter.scrubText("plain message"));
        assertNull(ErrorReporter.scrubText(null));

        SentryException exception = new SentryException();
        exception.setValue("duplicate key for bob@example.org");
        SentryEvent event = new SentryEvent();
        event.setExceptions(List.of(exception));
        ErrorReporter.scrub(event);
        assertEquals("duplicate key for [email]", event.getExceptions().get(0).getValue());
    }

    @Test
    @DisplayName("an unexpected error is a 500 with a generic message, and is reported")
    void unexpectedErrorsAreReported() {
        RecordingReporter reporter = new RecordingReporter();
        GlobalExceptionHandler handler = new GlobalExceptionHandler(reporter);
        RuntimeException failure = new RuntimeException("database exploded");

        ResponseEntity<Object> response = handler.handleRuntimeException(failure);

        assertEquals(HttpStatus.INTERNAL_SERVER_ERROR, response.getStatusCode());
        assertFalse(String.valueOf(response.getBody()).contains("database exploded"));
        assertEquals(List.of(failure), reporter.reported);

        Exception checked = new Exception("io problem");
        handler.handleGeneralException(checked);
        assertEquals(List.of(failure, checked), reporter.reported);
    }

    @Test
    @DisplayName("errors the app handles on purpose are not reported")
    void handledErrorsAreNotReported() {
        RecordingReporter reporter = new RecordingReporter();
        GlobalExceptionHandler handler = new GlobalExceptionHandler(reporter);

        assertEquals(HttpStatus.NOT_FOUND, handler.handleResourceNotFound(new ResourceNotFoundException("Outfit not found")).getStatusCode());
        assertEquals(HttpStatus.FORBIDDEN, handler.handleForbiddenOperation(new ForbiddenOperationException("no")).getStatusCode());

        assertTrue(reporter.reported.isEmpty());
    }
}
