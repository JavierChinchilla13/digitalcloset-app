package com.javier.closetapp.monitoring;

import io.sentry.Sentry;
import io.sentry.SentryEvent;
import io.sentry.protocol.SentryException;
import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.regex.Pattern;

// Task 104: reports unexpected server errors to Sentry. Off unless SENTRY_DSN is set (a blank DSN means the
// SDK is never started and report() does nothing). Only GlobalExceptionHandler's two catch-alls call it:
// errors the app handles on purpose (bad input, not found, forbidden...) are not reported. No request data,
// user or headers are attached (the plain SDK has no web integration), no tracing, and exception messages
// are scrubbed of emails and token-like strings before they leave, since a database error can quote a row.
@Component
public class ErrorReporter {

    private static final Pattern EMAIL = Pattern.compile("[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}");
    // A long run of URL-safe characters: a JWT, a reset token, a share token, an API key.
    private static final Pattern TOKEN = Pattern.compile("[A-Za-z0-9_-]{32,}");

    private final String dsn;
    private final String environment;

    public ErrorReporter(@Value("${sentry.dsn:}") String dsn,
                         @Value("${sentry.environment:production}") String environment) {
        this.dsn = dsn == null ? "" : dsn.trim();
        this.environment = environment;
    }

    // Starts the SDK once, only when a DSN is configured.
    @PostConstruct
    void start() {
        if (!isEnabled()) return;
        Sentry.init(options -> {
            options.setDsn(dsn);
            options.setEnvironment(environment);
            options.setSendDefaultPii(false);
            options.setTracesSampleRate(0.0);
            options.setBeforeSend((event, hint) -> scrub(event));
        });
    }

    public boolean isEnabled() {
        return !dsn.isEmpty();
    }

    // Sends the exception (no-op when monitoring is off). Never throws: reporting must not break a response.
    public void report(Throwable error) {
        if (!isEnabled() || error == null) return;
        try {
            Sentry.captureException(error);
        } catch (RuntimeException ignored) {
            // monitoring must never make an error worse
        }
    }

    // Removes emails and token-like strings from the event's messages.
    static SentryEvent scrub(SentryEvent event) {
        if (event.getExceptions() != null) {
            for (SentryException exception : event.getExceptions()) {
                exception.setValue(scrubText(exception.getValue()));
            }
        }
        if (event.getMessage() != null && event.getMessage().getFormatted() != null) {
            event.getMessage().setFormatted(scrubText(event.getMessage().getFormatted()));
        }
        return event;
    }

    // The text with emails and long token-like strings replaced by placeholders.
    static String scrubText(String text) {
        if (text == null) return null;
        return TOKEN.matcher(EMAIL.matcher(text).replaceAll("[email]")).replaceAll("[token]");
    }
}
