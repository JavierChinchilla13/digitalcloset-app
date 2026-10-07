package com.javier.closetapp.auth.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

// Body of POST /api/auth/google: the "credential" (a Google ID token) from Google's sign-in button.
public class GoogleLoginRequest {

    @NotBlank(message = "Credential is required")
    @Size(max = 4096, message = "Credential is too long")
    private String credential;

    public GoogleLoginRequest() {}

    public String getCredential() {
        return credential;
    }

    public void setCredential(String credential) {
        this.credential = credential;
    }
}
