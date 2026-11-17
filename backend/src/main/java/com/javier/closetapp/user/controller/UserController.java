package com.javier.closetapp.user.controller;

import com.javier.closetapp.auth.dto.AuthResponse;
import com.javier.closetapp.account.AccountExportService;
import com.javier.closetapp.user.dto.AdminCreateUserRequest;
import com.javier.closetapp.user.dto.DeleteAccountRequest;
import com.javier.closetapp.user.dto.ChangeEmailRequest;
import com.javier.closetapp.user.dto.ChangePasswordRequest;
import com.javier.closetapp.user.dto.ConfirmCodeRequest;
import com.javier.closetapp.user.dto.MainOutfitRequest;
import com.javier.closetapp.user.dto.SetPlanRequest;
import com.javier.closetapp.user.dto.UserResponse;
import com.javier.closetapp.user.dto.UserUpdateRequest;
import com.javier.closetapp.user.service.UserService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/users")
public class UserController {

    private final UserService userService;
    private final AccountExportService accountExportService;

    public UserController(UserService userService, AccountExportService accountExportService) {
        this.userService = userService;
        this.accountExportService = accountExportService;
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
    public ResponseEntity<AuthResponse> confirmPasswordChange(@Valid @RequestBody ConfirmCodeRequest request) {
        return ResponseEntity.ok(userService.confirmPasswordChange(request));
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

    // Audit H12: real erasure of the account and its data (replaces self-deactivation). POST, not DELETE, so the confirmation and
    // the proof travel in a body that proxies do not strip.
    @PostMapping("/me/delete")
    public ResponseEntity<Void> deleteCurrentAccount(@Valid @RequestBody DeleteAccountRequest request) {
        userService.deleteCurrentAccount(request);
        return ResponseEntity.noContent().build();
    }

    // Audit H12: "download my data" - the person's own data as one JSON file.
    @GetMapping("/me/export")
    public ResponseEntity<Map<String, Object>> exportMyData() {
        return ResponseEntity.ok()
                .header("Content-Disposition", "attachment; filename=\"vysvi-my-data.json\"")
                .contentType(MediaType.APPLICATION_JSON)
                .body(accountExportService.export());
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

    // Task 96: an admin gives an account the FREE or PREMIUM plan (more garments, no ads).
    @PatchMapping("/{id}/plan")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<UserResponse> setPlan(@PathVariable Long id, @Valid @RequestBody SetPlanRequest request) {
        return ResponseEntity.ok(userService.setPlan(id, request.getPlan()));
    }
}
