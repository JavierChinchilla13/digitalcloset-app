package com.javier.closetapp.persona.entity;

import com.javier.closetapp.common.enums.AvatarType;
import com.javier.closetapp.user.entity.User;
import jakarta.persistence.*;

// Task 60, Phase 9.5: a per-user, per-persona-type display name override
// (e.g. "M Persona" -> "My Guy"). Keyed by (owner, personaType) rather than
// fixed maleName/femaleName columns, so a future third AvatarType value
// needs no schema change - just a new possible row. Only overrides are
// stored here; a user with no row for a given personaType falls back to
// the frontend's own default ("M Persona"/"F Persona") - this table is
// never pre-seeded per user/persona-type combination.
@Entity
@Table(name = "persona_display_names")
public class PersonaDisplayName {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "persona_display_name_id")
    private Long personaDisplayNameId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "owner_user_id")
    private User owner;

    @Enumerated(EnumType.STRING)
    @Column(name = "persona_type", nullable = false)
    private AvatarType personaType;

    @Column(name = "display_name", nullable = false)
    private String displayName;

    public PersonaDisplayName() {}

    public Long getPersonaDisplayNameId() { return personaDisplayNameId; }
    public void setPersonaDisplayNameId(Long personaDisplayNameId) { this.personaDisplayNameId = personaDisplayNameId; }

    public User getOwner() { return owner; }
    public void setOwner(User owner) { this.owner = owner; }

    public AvatarType getPersonaType() { return personaType; }
    public void setPersonaType(AvatarType personaType) { this.personaType = personaType; }

    public String getDisplayName() { return displayName; }
    public void setDisplayName(String displayName) { this.displayName = displayName; }
}
