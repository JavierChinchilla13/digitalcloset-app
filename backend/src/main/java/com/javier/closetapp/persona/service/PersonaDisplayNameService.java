package com.javier.closetapp.persona.service;

import com.javier.closetapp.common.enums.AvatarType;
import com.javier.closetapp.persona.dto.PersonaDisplayNameResponse;
import com.javier.closetapp.persona.entity.PersonaDisplayName;
import com.javier.closetapp.persona.repository.PersonaDisplayNameRepository;
import com.javier.closetapp.user.entity.User;
import com.javier.closetapp.user.repository.UserRepository;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

// Task 60, Phase 9.5: business logic + ownership enforcement for persona
// display names. Mirrors CollectionService's pattern (Task 33/34).
@Service
public class PersonaDisplayNameService {

    private final PersonaDisplayNameRepository repository;
    private final UserRepository userRepository;

    public PersonaDisplayNameService(PersonaDisplayNameRepository repository, UserRepository userRepository) {
        this.repository = repository;
        this.userRepository = userRepository;
    }

    private User getAuthenticatedUser() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepository.findByEmail(email).orElseThrow(() -> new RuntimeException("User not found"));
    }

    // Only ever returns rows that exist - a persona type with no override
    // simply doesn't appear here. The frontend applies its own default
    // ("M Persona"/"F Persona") for whatever's missing.
    public List<PersonaDisplayNameResponse> getAll() {
        User user = getAuthenticatedUser();
        return repository.findByOwner(user).stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    @Transactional
    public PersonaDisplayNameResponse upsert(AvatarType personaType, String displayName) {
        User user = getAuthenticatedUser();
        PersonaDisplayName entity = repository.findByOwnerAndPersonaType(user, personaType)
                .orElseGet(() -> {
                    PersonaDisplayName created = new PersonaDisplayName();
                    created.setOwner(user);
                    created.setPersonaType(personaType);
                    return created;
                });
        entity.setDisplayName(displayName);
        return mapToResponse(repository.save(entity));
    }

    // Deletes the override, reverting that persona type back to the
    // frontend's default display name.
    @Transactional
    public void reset(AvatarType personaType) {
        User user = getAuthenticatedUser();
        repository.findByOwnerAndPersonaType(user, personaType).ifPresent(repository::delete);
    }

    private PersonaDisplayNameResponse mapToResponse(PersonaDisplayName entity) {
        PersonaDisplayNameResponse res = new PersonaDisplayNameResponse();
        res.setPersonaType(entity.getPersonaType());
        res.setDisplayName(entity.getDisplayName());
        return res;
    }
}
