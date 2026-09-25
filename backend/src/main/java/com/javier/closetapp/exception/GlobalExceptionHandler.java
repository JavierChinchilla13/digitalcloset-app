package com.javier.closetapp.exception;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.AuthenticationException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.ExceptionHandler;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

@ControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    // Resource lookups that failed (item/outfit not found, or not owned by the
    // caller) - the message is a safe, developer-written string, not raw
    // internal detail, so it's fine to return as-is.
    @ExceptionHandler(ResourceNotFoundException.class)
    public ResponseEntity<Object> handleResourceNotFound(ResourceNotFoundException ex) {
        Map<String, Object> body = new HashMap<>();
        body.put("timestamp", LocalDateTime.now());
        body.put("message", ex.getMessage());

        return new ResponseEntity<>(body, HttpStatus.NOT_FOUND);
    }

    // Ownership checks that failed - same reasoning as ResourceNotFoundException.
    @ExceptionHandler(ForbiddenOperationException.class)
    public ResponseEntity<Object> handleForbiddenOperation(ForbiddenOperationException ex) {
        Map<String, Object> body = new HashMap<>();
        body.put("timestamp", LocalDateTime.now());
        body.put("message", ex.getMessage());

        return new ResponseEntity<>(body, HttpStatus.FORBIDDEN);
    }

    // Password reset link that can't be used (unknown/expired/used) - a client
    // error the user can act on (request a new link), so 400 with the message.
    @ExceptionHandler(InvalidResetTokenException.class)
    public ResponseEntity<Object> handleInvalidResetToken(InvalidResetTokenException ex) {
        Map<String, Object> body = new HashMap<>();
        body.put("timestamp", LocalDateTime.now());
        body.put("message", ex.getMessage());

        return new ResponseEntity<>(body, HttpStatus.BAD_REQUEST);
    }

    // Thrown by @Valid when a request body fails its DTO's constraints. Doesn't
    // extend RuntimeException, so without this handler it would fall through to
    // the generic Exception handler below and incorrectly return 500 instead of
    // 400 - this must stay registered for @Valid to actually produce a 400.
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Object> handleValidationException(MethodArgumentNotValidException ex) {
        Map<String, String> fieldErrors = new HashMap<>();
        ex.getBindingResult().getFieldErrors()
                .forEach(error -> fieldErrors.put(error.getField(), error.getDefaultMessage()));

        Map<String, Object> body = new HashMap<>();
        body.put("timestamp", LocalDateTime.now());
        body.put("message", "Validation failed");
        body.put("errors", fieldErrors);

        return new ResponseEntity<>(body, HttpStatus.BAD_REQUEST);
    }

    // Bad credentials / unknown user from AuthenticationManager.authenticate()
    // - AuthenticationException is a RuntimeException, so without this handler
    // it falls through to the generic RuntimeException handler below and
    // returns a misleading 500 instead of a proper 401.
    @ExceptionHandler(AuthenticationException.class)
    public ResponseEntity<Object> handleAuthenticationException(AuthenticationException ex) {
        Map<String, Object> body = new HashMap<>();
        body.put("timestamp", LocalDateTime.now());
        body.put("message", "Invalid email or password");

        return new ResponseEntity<>(body, HttpStatus.UNAUTHORIZED);
    }

    // Fallback for anything else (unexpected RuntimeExceptions, NPEs, DB errors,
    // etc.). The real exception is logged server-side for debugging, but never
    // returned to the client - its message could contain internal details
    // (SQL, stack info, class names) that shouldn't be exposed over the API.
    @ExceptionHandler(RuntimeException.class)
    public ResponseEntity<Object> handleRuntimeException(RuntimeException ex) {
        log.error("Unhandled RuntimeException", ex);

        Map<String, Object> body = new HashMap<>();
        body.put("timestamp", LocalDateTime.now());
        body.put("message", "An unexpected error occurred");

        return new ResponseEntity<>(body, HttpStatus.INTERNAL_SERVER_ERROR);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Object> handleGeneralException(Exception ex) {
        log.error("Unhandled Exception", ex);

        Map<String, Object> body = new HashMap<>();
        body.put("timestamp", LocalDateTime.now());
        body.put("message", "An unexpected error occurred");

        return new ResponseEntity<>(body, HttpStatus.INTERNAL_SERVER_ERROR);
    }
}
