package com.javier.closetapp.user.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

// Body of PUT /api/users/me/email. Requires the current password: email is
// the login identifier, so changing it without re-proving the password would
// let a hijacked session lock the real owner out.
public class ChangeEmailRequest {

    @NotBlank(message = "Email is required")
    @Email(message = "Email must be a valid email address")
    private String newEmail;

    @NotBlank(message = "Current password is required")
    private String currentPassword;

    public ChangeEmailRequest() {}

    public String getNewEmail() {
        return newEmail;
    }

    public void setNewEmail(String newEmail) {
        this.newEmail = newEmail;
    }

    public String getCurrentPassword() {
        return currentPassword;
    }

    public void setCurrentPassword(String currentPassword) {
        this.currentPassword = currentPassword;
    }
}
