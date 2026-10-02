package com.javier.closetapp.auth.dto;

// What login/register return: the JWT to send as `Authorization: Bearer <token>`, and who it belongs to.
public class AuthResponse {
    private String token;
    private Long userId;
    private String email;

    public AuthResponse() {}

    public AuthResponse(String token, Long userId, String email) {
        this.token = token;
        this.userId = userId;
        this.email = email;
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
