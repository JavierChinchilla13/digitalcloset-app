package com.javier.closetapp.user.dto;

import jakarta.validation.constraints.NotBlank;

// Body of POST /api/users/me/email/confirm and .../password/confirm - the
// 6-digit code emailed for the matching /request call.
public class ConfirmCodeRequest {

    @NotBlank(message = "Code is required")
    private String code;

    public ConfirmCodeRequest() {}

    public String getCode() {
        return code;
    }

    public void setCode(String code) {
        this.code = code;
    }
}
