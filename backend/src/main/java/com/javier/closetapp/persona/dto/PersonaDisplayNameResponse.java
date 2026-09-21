package com.javier.closetapp.persona.dto;

import com.javier.closetapp.common.enums.AvatarType;

public class PersonaDisplayNameResponse {
    private AvatarType personaType;
    private String displayName;

    public PersonaDisplayNameResponse() {}

    public AvatarType getPersonaType() { return personaType; }
    public void setPersonaType(AvatarType personaType) { this.personaType = personaType; }

    public String getDisplayName() { return displayName; }
    public void setDisplayName(String displayName) { this.displayName = displayName; }
}
