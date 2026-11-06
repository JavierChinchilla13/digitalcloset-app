package com.javier.closetapp.persona.dto;

import com.javier.closetapp.common.TextLimits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

// Body to set a persona's display name (must not be blank).
public class PersonaDisplayNameRequest {
    @NotBlank(message = "Display name is required")
    @Size(max = TextLimits.PERSONA_NAME, message = "Display name must be at most 30 characters")
    private String displayName;

    public PersonaDisplayNameRequest() {}

    public String getDisplayName() { return displayName; }
    public void setDisplayName(String displayName) { this.displayName = displayName; }
}
