package com.javier.closetapp.persona.controller;

import com.javier.closetapp.common.enums.AvatarType;
import com.javier.closetapp.persona.dto.PersonaDisplayNameRequest;
import com.javier.closetapp.persona.dto.PersonaDisplayNameResponse;
import com.javier.closetapp.persona.service.PersonaDisplayNameService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

// Mirrors CollectionController's pattern - thin controller, ownership
// enforced in the service (Task 60, Phase 9.5).
@RestController
@RequestMapping("/api/persona-display-names")
public class PersonaDisplayNameController {

    private final PersonaDisplayNameService service;

    public PersonaDisplayNameController(PersonaDisplayNameService service) {
        this.service = service;
    }

    @GetMapping
    public ResponseEntity<List<PersonaDisplayNameResponse>> getAll() {
        return ResponseEntity.ok(service.getAll());
    }

    @PutMapping("/{personaType}")
    public ResponseEntity<PersonaDisplayNameResponse> upsert(
            @PathVariable AvatarType personaType,
            @Valid @RequestBody PersonaDisplayNameRequest request
    ) {
        return ResponseEntity.ok(service.upsert(personaType, request.getDisplayName()));
    }

    @DeleteMapping("/{personaType}")
    public ResponseEntity<Void> reset(@PathVariable AvatarType personaType) {
        service.reset(personaType);
        return ResponseEntity.noContent().build();
    }
}
