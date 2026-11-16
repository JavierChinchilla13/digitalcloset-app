package com.javier.closetapp.exception;

import com.javier.closetapp.monitoring.ErrorReporter;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.HttpMediaTypeNotSupportedException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.servlet.resource.NoResourceFoundException;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.ExceptionHandler;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

@ControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    // Task 104: told about the errors nobody expected (the two catch-alls at the bottom).
    private final ErrorReporter errorReporter;

    public GlobalExceptionHandler(ErrorReporter errorReporter) {
        this.errorReporter = errorReporter;
    }

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

    // Email already taken (register / change-email / admin create-user).
    @ExceptionHandler(DuplicateEmailException.class)
    public ResponseEntity<Object> handleDuplicateEmail(DuplicateEmailException ex) {
        Map<String, Object> body = new HashMap<>();
        body.put("timestamp", LocalDateTime.now());
        body.put("message", ex.getMessage());

        return new ResponseEntity<>(body, HttpStatus.CONFLICT);
    }

    // Ownership checks that failed - same reasoning as ResourceNotFoundException.
    @ExceptionHandler(ForbiddenOperationException.class)
    public ResponseEntity<Object> handleForbiddenOperation(ForbiddenOperationException ex) {
        Map<String, Object> body = new HashMap<>();
        body.put("timestamp", LocalDateTime.now());
        body.put("message", ex.getMessage());

        return new ResponseEntity<>(body, HttpStatus.FORBIDDEN);
    }

    // Task 98: a Google sign-in that cannot go ahead - the status and message come from the exception.
    @ExceptionHandler(GoogleSignInException.class)
    public ResponseEntity<Object> handleGoogleSignIn(GoogleSignInException ex) {
        return clientError(HttpStatus.valueOf(ex.getStatus()), ex.getMessage());
    }

    // Task 96: the account is at its garment limit. A 403 with a stable `code` (and the limit / plan) so the
    // frontend can tell it from an ownership refusal and show the upgrade hint.
    @ExceptionHandler(GarmentLimitExceededException.class)
    public ResponseEntity<Object> handleGarmentLimit(GarmentLimitExceededException ex) {
        Map<String, Object> body = new HashMap<>();
        body.put("timestamp", LocalDateTime.now());
        body.put("message", ex.getMessage());
        body.put("code", "GARMENT_LIMIT");
        body.put("limit", ex.getLimit());
        body.put("plan", ex.getPlan());

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

    // Verification code that can't be used (unknown/expired/used/wrong) - a
    // client error the user can act on (request a new code), so 400. Same
    // one-message-for-every-case reasoning as InvalidResetTokenException.
    @ExceptionHandler(InvalidVerificationCodeException.class)
    public ResponseEntity<Object> handleInvalidVerificationCode(InvalidVerificationCodeException ex) {
        Map<String, Object> body = new HashMap<>();
        body.put("timestamp", LocalDateTime.now());
        body.put("message", ex.getMessage());

        return new ResponseEntity<>(body, HttpStatus.BAD_REQUEST);
    }

    // An outfit that breaks a rule (e.g. two shoes for one foot) - fixable by
    // the caller, so 400 with the message.
    @ExceptionHandler(InvalidOutfitException.class)
    public ResponseEntity<Object> handleInvalidOutfit(InvalidOutfitException ex) {
        Map<String, Object> body = new HashMap<>();
        body.put("timestamp", LocalDateTime.now());
        body.put("message", ex.getMessage());

        return new ResponseEntity<>(body, HttpStatus.BAD_REQUEST);
    }

    // Audit H12: a sign-up refused for age. Always the same 403 and message; deliberately NOT logged (no email, no date).
    @ExceptionHandler(AgeNotAllowedException.class)
    public ResponseEntity<Object> handleAgeNotAllowed(AgeNotAllowedException ex) {
        Map<String, Object> body = new HashMap<>();
        body.put("timestamp", LocalDateTime.now());
        body.put("message", ex.getMessage());
        body.put("code", "AGE_NOT_ALLOWED");

        return new ResponseEntity<>(body, HttpStatus.FORBIDDEN);
    }

    // Audit H7: text that is too long and similar - fixable by the caller, so 400 with the message.
    @ExceptionHandler(InvalidInputException.class)
    public ResponseEntity<Object> handleInvalidInput(InvalidInputException ex) {
        Map<String, Object> body = new HashMap<>();
        body.put("timestamp", LocalDateTime.now());
        body.put("message", ex.getMessage());

        return new ResponseEntity<>(body, HttpStatus.BAD_REQUEST);
    }

    // Audit M9: a name the user already has (a category) - 409 with the message.
    @ExceptionHandler(DuplicateNameException.class)
    public ResponseEntity<Object> handleDuplicateName(DuplicateNameException ex) {
        Map<String, Object> body = new HashMap<>();
        body.put("timestamp", LocalDateTime.now());
        body.put("message", ex.getMessage());

        return new ResponseEntity<>(body, HttpStatus.CONFLICT);
    }

    // Audit M9: backstop for a uniqueness rule the database enforces and no service checked first (two requests
    // racing for the same name). A 409 instead of a 500; the message does not quote the database error.
    @ExceptionHandler(org.springframework.dao.DataIntegrityViolationException.class)
    public ResponseEntity<Object> handleDataIntegrity(org.springframework.dao.DataIntegrityViolationException ex) {
        log.warn("Data integrity violation: {}", describe(ex));
        Map<String, Object> body = new HashMap<>();
        body.put("timestamp", LocalDateTime.now());
        body.put("message", "That value is already in use.");

        return new ResponseEntity<>(body, HttpStatus.CONFLICT);
    }

    // Audit M3: a garment picture address outside the app's own image host - fixable by the caller, so 400.
    @ExceptionHandler(InvalidImageUrlException.class)
    public ResponseEntity<Object> handleInvalidImageUrl(InvalidImageUrlException ex) {
        Map<String, Object> body = new HashMap<>();
        body.put("timestamp", LocalDateTime.now());
        body.put("message", ex.getMessage());

        return new ResponseEntity<>(body, HttpStatus.BAD_REQUEST);
    }

    // Task 103: a billing request that cannot be done (payments not set up, already subscribed).
    @ExceptionHandler(com.javier.closetapp.billing.BillingException.class)
    public ResponseEntity<Object> handleBilling(com.javier.closetapp.billing.BillingException ex) {
        Map<String, Object> body = new HashMap<>();
        body.put("timestamp", LocalDateTime.now());
        body.put("message", ex.getMessage());

        return new ResponseEntity<>(body, HttpStatus.BAD_REQUEST);
    }

    // A verification code was requested again too soon (the "Resend" abuse guard).
    @ExceptionHandler(TooManyRequestsException.class)
    public ResponseEntity<Object> handleTooManyRequests(TooManyRequestsException ex) {
        Map<String, Object> body = new HashMap<>();
        body.put("timestamp", LocalDateTime.now());
        body.put("message", ex.getMessage());

        return new ResponseEntity<>(body, HttpStatus.TOO_MANY_REQUESTS);
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

    // Task 24: mistakes in the REQUEST itself (broken JSON, wrong HTTP method,
    // wrong content type, a missing or malformed parameter, too big an upload, an
    // unknown path). These are framework exceptions that used to fall through to
    // the catch-all handlers below and come back as a 500 "unexpected error",
    // which misreports a client error as a server fault (and, in production, pages
    // whoever watches the 5xx rate). Each now gets its proper 4xx with a short,
    // fixed message - never the exception's own text.
    @ExceptionHandler({HttpMessageNotReadableException.class, MissingServletRequestParameterException.class,
            MethodArgumentTypeMismatchException.class})
    public ResponseEntity<Object> handleMalformedRequest(Exception ex) {
        return clientError(HttpStatus.BAD_REQUEST, "Malformed request");
    }

    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    public ResponseEntity<Object> handleMethodNotSupported(HttpRequestMethodNotSupportedException ex) {
        return clientError(HttpStatus.METHOD_NOT_ALLOWED, "Method not allowed");
    }

    @ExceptionHandler(HttpMediaTypeNotSupportedException.class)
    public ResponseEntity<Object> handleMediaTypeNotSupported(HttpMediaTypeNotSupportedException ex) {
        return clientError(HttpStatus.UNSUPPORTED_MEDIA_TYPE, "Unsupported content type");
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<Object> handleUploadTooLarge(MaxUploadSizeExceededException ex) {
        return clientError(HttpStatus.PAYLOAD_TOO_LARGE, "File is too large");
    }

    @ExceptionHandler(NoResourceFoundException.class)
    public ResponseEntity<Object> handleNoResource(NoResourceFoundException ex) {
        return clientError(HttpStatus.NOT_FOUND, "Not found");
    }

    private static ResponseEntity<Object> clientError(HttpStatus status, String message) {
        Map<String, Object> body = new HashMap<>();
        body.put("timestamp", LocalDateTime.now());
        body.put("message", message);
        return new ResponseEntity<>(body, status);
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

    // A signed-in user calling something their role doesn't allow (e.g. a normal
    // user on an @PreAuthorize("hasRole('ADMIN')") endpoint). AccessDeniedException
    // is a RuntimeException, so without this handler it fell through to the
    // generic handler below and came back as a 500 instead of a 403.
    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<Object> handleAccessDenied(AccessDeniedException ex) {
        Map<String, Object> body = new HashMap<>();
        body.put("timestamp", LocalDateTime.now());
        body.put("message", "You do not have permission to do this");

        return new ResponseEntity<>(body, HttpStatus.FORBIDDEN);
    }

    // What goes to the log for an unexpected error (audit M25): the exception types and where it happened, never
    // the messages. A database error's message can quote a row (an email, a name) and the log is kept by the host;
    // the full exception, with its message, goes to Sentry, which scrubs it.
    static String describe(Throwable ex) {
        StringBuilder out = new StringBuilder(ex.getClass().getName());
        Throwable root = ex;
        while (root.getCause() != null && root.getCause() != root) root = root.getCause();
        if (root != ex) out.append(" (root cause ").append(root.getClass().getName()).append(")");
        StackTraceElement[] frames = root.getStackTrace();
        for (int i = 0; i < Math.min(frames.length, 8); i++) {
            out.append("\n    at ").append(frames[i]);
        }
        return out.toString();
    }

    // Fallback for anything else (unexpected RuntimeExceptions, NPEs, DB errors,
    // etc.). The real exception is logged server-side for debugging, but never
    // returned to the client - its message could contain internal details
    // (SQL, stack info, class names) that shouldn't be exposed over the API.
    @ExceptionHandler(RuntimeException.class)
    public ResponseEntity<Object> handleRuntimeException(RuntimeException ex) {
        log.error("Unhandled RuntimeException: {}", describe(ex));
        errorReporter.report(ex);

        Map<String, Object> body = new HashMap<>();
        body.put("timestamp", LocalDateTime.now());
        body.put("message", "An unexpected error occurred");

        return new ResponseEntity<>(body, HttpStatus.INTERNAL_SERVER_ERROR);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Object> handleGeneralException(Exception ex) {
        log.error("Unhandled Exception: {}", describe(ex));
        errorReporter.report(ex);

        Map<String, Object> body = new HashMap<>();
        body.put("timestamp", LocalDateTime.now());
        body.put("message", "An unexpected error occurred");

        return new ResponseEntity<>(body, HttpStatus.INTERNAL_SERVER_ERROR);
    }
}
