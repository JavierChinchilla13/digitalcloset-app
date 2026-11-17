package com.javier.closetapp.user.dto;

import com.javier.closetapp.common.enums.Plan;
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
    // Task 96: FREE or PREMIUM, and how many garments the account may keep (null = unlimited,
    // i.e. an admin). The garment count is not here: it goes stale, the client counts its own list.
    private Plan plan;
    private Integer garmentLimit;
    // Audit H12: true when the person must still give (or give again) their birth month/year and acceptances (an account made
    // before they were asked, or after the texts changed). The website holds them on that step until it is done.
    private boolean needsLegalConfirmation;
    // Audit H12: "MINOR" (13-17) or "ADULT", worked out from the recorded birth month/year; null when not recorded. The website
    // uses it to hide ads for minors and Premium for them; the server enforces the same rule.
    private String ageBand;
    // Audit H12: false for an account that signs in only with Google (no password): the website then asks for a fresh Google
    // confirmation, not a password, before deleting the account. The hash itself is never sent.
    private boolean hasPassword;

    public UserResponse() {}

    public UserResponse(Long userId, String email, String firstName, String lastName, Role role, boolean active, LocalDateTime createdAt, Long mainOutfitId,
                        Plan plan, Integer garmentLimit, boolean needsLegalConfirmation, String ageBand,
                        boolean hasPassword) {
        this.userId = userId;
        this.email = email;
        this.firstName = firstName;
        this.lastName = lastName;
        this.role = role;
        this.active = active;
        this.createdAt = createdAt;
        this.mainOutfitId = mainOutfitId;
        this.plan = plan;
        this.garmentLimit = garmentLimit;
        this.needsLegalConfirmation = needsLegalConfirmation;
        this.ageBand = ageBand;
        this.hasPassword = hasPassword;
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

    public Plan getPlan() {
        return plan;
    }

    public void setPlan(Plan plan) {
        this.plan = plan;
    }

    public Integer getGarmentLimit() {
        return garmentLimit;
    }

    public void setGarmentLimit(Integer garmentLimit) {
        this.garmentLimit = garmentLimit;
    }

    public boolean isNeedsLegalConfirmation() {
        return needsLegalConfirmation;
    }

    public void setNeedsLegalConfirmation(boolean needsLegalConfirmation) {
        this.needsLegalConfirmation = needsLegalConfirmation;
    }

    public String getAgeBand() {
        return ageBand;
    }

    public void setAgeBand(String ageBand) {
        this.ageBand = ageBand;
    }

    public boolean isHasPassword() {
        return hasPassword;
    }

    public void setHasPassword(boolean hasPassword) {
        this.hasPassword = hasPassword;
    }
}
