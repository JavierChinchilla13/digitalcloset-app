package com.javier.closetapp.persona.dto;

import jakarta.validation.constraints.NotBlank;

public class PersonaDisplayNameRequest {
    @NotBlank(message = "Display name is required")
    private String displayName;

    public PersonaDisplayNameRequest() {}

    public String getDisplayName() { return displayName; }
    public void setDisplayName(String displayName) { this.displayName = displayName; }
}
