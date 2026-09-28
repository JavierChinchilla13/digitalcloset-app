package com.javier.closetapp.user.controller;

import com.javier.closetapp.user.dto.MainOutfitRequest;
import com.javier.closetapp.user.dto.UserResponse;
import com.javier.closetapp.user.dto.UserUpdateRequest;
import com.javier.closetapp.user.service.UserService;
import jakarta.validation.Valid;
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
