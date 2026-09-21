package com.javier.closetapp.persona.repository;

import com.javier.closetapp.common.enums.AvatarType;
import com.javier.closetapp.persona.entity.PersonaDisplayName;
import com.javier.closetapp.user.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface PersonaDisplayNameRepository extends JpaRepository<PersonaDisplayName, Long> {
    List<PersonaDisplayName> findByOwner(User owner);
    Optional<PersonaDisplayName> findByOwnerAndPersonaType(User owner, AvatarType personaType);
}
