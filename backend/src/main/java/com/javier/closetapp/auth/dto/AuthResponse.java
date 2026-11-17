package com.javier.closetapp.auth.dto;

// What login/register return: the JWT to send as `Authorization: Bearer <token>`, and who it belongs to.
public class AuthResponse {
    private String token;
    private Long userId;
    private String email;
    // Audit H12: true when a NEW Google identity has been verified but not signed up yet (nothing was created):
    // the page must collect the birth month/year and the acceptances and call /api/auth/google/complete.
    private boolean needsProfile = false;

    public AuthResponse() {}

    public AuthResponse(String token, Long userId, String email) {
        this.token = token;
        this.userId = userId;
        this.email = email;
    }

    // The answer for a new Google identity: only the verified email (to show "continuing as ..."), no token, no account.
    public static AuthResponse needsProfile(String email) {
        AuthResponse response = new AuthResponse();
        response.email = email;
        response.needsProfile = true;
        return response;
    }

    public boolean isNeedsProfile() {
        return needsProfile;
    }

    public void setNeedsProfile(boolean needsProfile) {
        this.needsProfile = needsProfile;
    }

    public String getToken() {
        return token;
    }

    public void setToken(String token) {
        this.token = token;
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
}
