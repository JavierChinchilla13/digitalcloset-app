package com.javier.closetapp.user.controller;

import com.javier.closetapp.auth.dto.AuthResponse;
import com.javier.closetapp.user.dto.AdminCreateUserRequest;
import com.javier.closetapp.user.dto.ChangeEmailRequest;
import com.javier.closetapp.user.dto.ChangePasswordRequest;
import com.javier.closetapp.user.dto.ConfirmCodeRequest;
import com.javier.closetapp.user.dto.MainOutfitRequest;
import com.javier.closetapp.user.dto.UserResponse;
import com.javier.closetapp.user.dto.UserUpdateRequest;
import com.javier.closetapp.user.service.UserService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/users")
public class UserController {

    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
    }

    @GetMapping("/me")
    public ResponseEntity<UserResponse> getCurrentUser() {
        return ResponseEntity.ok(userService.getCurrentUserResponse());
    }

    @PutMapping("/me")
    public ResponseEntity<UserResponse> updateCurrentUser(@Valid @RequestBody UserUpdateRequest request) {
        return ResponseEntity.ok(userService.updateCurrentUser(request));
    }

    // Main outfit (Task 78): the outfit the Showcase opens on and Attire edits.
    @PutMapping("/me/main-outfit")
    public ResponseEntity<UserResponse> setMainOutfit(@Valid @RequestBody MainOutfitRequest request) {
        return ResponseEntity.ok(userService.setMainOutfit(request.getOutfitId()));
    }

    @DeleteMapping("/me/main-outfit")
    public ResponseEntity<UserResponse> clearMainOutfit() {
        return ResponseEntity.ok(userService.clearMainOutfit());
    }

    // Settings (Task 79 follow-up): self-service password/email changes, each
    // a two-step request -> emailed code -> confirm, so a hijacked session
    // alone can't silently change either - see UserService for why.
    @PostMapping("/me/password/request")
    public ResponseEntity<Void> requestPasswordChange(@Valid @RequestBody ChangePasswordRequest request) {
        userService.requestPasswordChange(request);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/me/password/confirm")
    public ResponseEntity<Void> confirmPasswordChange(@Valid @RequestBody ConfirmCodeRequest request) {
        userService.confirmPasswordChange(request);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/me/email/request")
    public ResponseEntity<Void> requestEmailChange(@Valid @RequestBody ChangeEmailRequest request) {
        userService.requestEmailChange(request);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/me/email/confirm")
    public ResponseEntity<AuthResponse> confirmEmailChange(@Valid @RequestBody ConfirmCodeRequest request) {
        return ResponseEntity.ok(userService.confirmEmailChange(request));
    }

    @PatchMapping("/me/deactivate")
    public ResponseEntity<Void> deactivateCurrentUser() {
        userService.deactivateCurrentUser();
        return ResponseEntity.noContent().build();
    }

    // Admin Endpoints
    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<List<UserResponse>> getAllUsers() {
        return ResponseEntity.ok(userService.getAllUsers());
    }

    // Task 79: only admins can reach this endpoint at all, and it's the only
    // way to create an account with a role - the admin picks it explicitly.
    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<UserResponse> createUser(@Valid @RequestBody AdminCreateUserRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(userService.createUser(request));
    }

    @PatchMapping("/{id}/deactivate")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<UserResponse> deactivateUser(@PathVariable Long id) {
        return ResponseEntity.ok(userService.deactivateUser(id));
    }

    @PatchMapping("/{id}/reactivate")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<UserResponse> reactivateUser(@PathVariable Long id) {
        return ResponseEntity.ok(userService.reactivateUser(id));
    }
}
