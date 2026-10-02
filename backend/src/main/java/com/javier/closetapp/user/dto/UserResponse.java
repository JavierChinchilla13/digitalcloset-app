package com.javier.closetapp.user.dto;

import com.javier.closetapp.common.enums.Role;
import java.time.LocalDateTime;

// An account as the frontend sees it - never includes the password hash.
public class UserResponse {
    private Long userId;
    private String email;
    private String firstName;
    private String lastName;
    private Role role;
    private boolean active;
    private LocalDateTime createdAt;
    // Null when the user has no main outfit (Task 78).
    private Long mainOutfitId;

    public UserResponse() {}

    public UserResponse(Long userId, String email, String firstName, String lastName, Role role, boolean active, LocalDateTime createdAt, Long mainOutfitId) {
        this.userId = userId;
        this.email = email;
        this.firstName = firstName;
        this.lastName = lastName;
        this.role = role;
        this.active = active;
        this.createdAt = createdAt;
        this.mainOutfitId = mainOutfitId;
    }

    public Long getUserId() {
        return userId;
    }

    public void setUserId(Long userId) {
        this.userId = userId;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getFirstName() {
        return firstName;
    }

    public void setFirstName(String firstName) {
        this.firstName = firstName;
    }

    public String getLastName() {
        return lastName;
    }

    public void setLastName(String lastName) {
        this.lastName = lastName;
    }

    public Role getRole() {
        return role;
    }

    public void setRole(Role role) {
        this.role = role;
    }

    public boolean isActive() {
        return active;
    }

    public void setActive(boolean active) {
        this.active = active;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public Long getMainOutfitId() {
        return mainOutfitId;
    }

    public void setMainOutfitId(Long mainOutfitId) {
        this.mainOutfitId = mainOutfitId;
    }
}
