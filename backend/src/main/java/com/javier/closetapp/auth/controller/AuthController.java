package com.javier.closetapp.auth.controller;

import com.javier.closetapp.auth.dto.AuthResponse;
import com.javier.closetapp.auth.dto.ForgotPasswordRequest;
import com.javier.closetapp.auth.dto.GoogleCompleteRequest;
import com.javier.closetapp.auth.dto.GoogleLoginRequest;
import com.javier.closetapp.auth.dto.LoginRequest;
import com.javier.closetapp.auth.dto.RegisterRequest;
import com.javier.closetapp.auth.dto.ResetPasswordRequest;
import com.javier.closetapp.auth.service.AuthService;
import com.javier.closetapp.auth.service.PasswordResetService;
import com.javier.closetapp.exception.AgeNotAllowedException;
import com.javier.closetapp.legal.AgeRejectionLimiter;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;
    private final PasswordResetService passwordResetService;
    private final AgeRejectionLimiter ageRejectionLimiter;

    public AuthController(AuthService authService, PasswordResetService passwordResetService,
                          AgeRejectionLimiter ageRejectionLimiter) {
        this.authService = authService;
        this.passwordResetService = passwordResetService;
        this.ageRejectionLimiter = ageRejectionLimiter;
    }

    // Always the same response, whether or not the email has an account, so
    // this can't be used to discover which emails are registered.
    @PostMapping("/forgot-password")
    public ResponseEntity<Map<String, String>> forgotPassword(@Valid @RequestBody ForgotPasswordRequest request) {
        passwordResetService.requestReset(request.getEmail());
        return ResponseEntity.ok(Map.of("message",
                "If an account exists for that email, a password reset link has been sent."));
    }

    @PostMapping("/reset-password")
    public ResponseEntity<Map<String, String>> resetPassword(@Valid @RequestBody ResetPasswordRequest request) {
        passwordResetService.resetPassword(request.getToken(), request.getPassword());
        return ResponseEntity.ok(Map.of("message", "Your password has been updated. You can now sign in."));
    }

    @PostMapping("/register")
    public ResponseEntity<AuthResponse> register(@Valid @RequestBody RegisterRequest request, HttpServletRequest http) {
        // Audit H12: the age-refusal counter (off unless configured) looks at the client address only, in memory.
        String address = http.getRemoteAddr();
        ageRejectionLimiter.requireNotBlocked(address);
        try {
            return ResponseEntity.ok(authService.register(request));
        } catch (AgeNotAllowedException refused) {
            ageRejectionLimiter.recordRejection(address);
            throw refused;
        }
    }

    // Audit H12: the second step of a NEW Google sign-up (birth month/year, acceptances). Same refusal counter as register.
    @PostMapping("/google/complete")
    public ResponseEntity<AuthResponse> googleComplete(@Valid @RequestBody GoogleCompleteRequest request, HttpServletRequest http) {
        String address = http.getRemoteAddr();
        ageRejectionLimiter.requireNotBlocked(address);
        try {
            return ResponseEntity.ok(authService.googleComplete(request));
        } catch (AgeNotAllowedException refused) {
            ageRejectionLimiter.recordRejection(address);
            throw refused;
        }
    }

    // Task 98: "Sign in with Google" - exchanges Google's ID token for this app's own JWT.
    @PostMapping("/google")
    public ResponseEntity<AuthResponse> google(@Valid @RequestBody GoogleLoginRequest request) {
        return ResponseEntity.ok(authService.googleLogin(request.getCredential()));
    }

    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@Valid @RequestBody LoginRequest request) {
        return ResponseEntity.ok(authService.login(request));
    }
}
