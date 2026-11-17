package com.javier.closetapp.user.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

// Audit H12: the body of "delete my account and data". The person types DELETE (the website asks for it too, so a stray call
// cannot do this) and proves who they are: their password, or for an account that signs in only with Google, a fresh Google credential.
public class DeleteAccountRequest {
    @NotBlank(message = "Confirmation is required")
    private String confirmation;

    @Size(max = 200, message = "Password is too long")
    private String password;

    @Size(max = 4096, message = "Credential is too long")
    private String googleCredential;

    public DeleteAccountRequest() {}

    public String getConfirmation() { return confirmation; }
    public void setConfirmation(String confirmation) { this.confirmation = confirmation; }
    public String getPassword() { return password; }
    public void setPassword(String password) { this.password = password; }
    public String getGoogleCredential() { return googleCredential; }
    public void setGoogleCredential(String googleCredential) { this.googleCredential = googleCredential; }
}
