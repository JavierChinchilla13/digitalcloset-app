package com.javier.closetapp.outfit.controller;

import com.javier.closetapp.outfit.dto.OutfitRequest;
import com.javier.closetapp.outfit.dto.OutfitResponse;
import com.javier.closetapp.outfit.service.OutfitService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

// HTTP layer of /api/outfits: a thin wrapper, the rules (ownership, one shoe per foot) are in OutfitService.
@RestController
@RequestMapping("/api/outfits")
public class OutfitController {

    private final OutfitService outfitService;

    public OutfitController(OutfitService outfitService) {
        this.outfitService = outfitService;
    }

    @PostMapping
    public ResponseEntity<OutfitResponse> saveOutfit(@Valid @RequestBody OutfitRequest request) {
        return ResponseEntity.ok(outfitService.saveOutfit(request));
    }

    @GetMapping
    public ResponseEntity<List<OutfitResponse>> getAllOutfits() {
        return ResponseEntity.ok(outfitService.getAllOutfits());
    }

    // Unlike ClothingController.updateItem, OutfitService.updateOutfit() fully
    // replaces name/description/avatarType/items rather than partially applying
    // them, so @Valid is safe here too.
    @PutMapping("/{id}")
    public ResponseEntity<OutfitResponse> updateOutfit(@PathVariable Long id, @Valid @RequestBody OutfitRequest request) {
        return ResponseEntity.ok(outfitService.updateOutfit(id, request));
    }

    // Task 102: create (or return the existing) public link of an outfit, and turn it off again.
    @PostMapping("/{id}/share")
    public ResponseEntity<OutfitResponse> shareOutfit(@PathVariable Long id) {
        return ResponseEntity.ok(outfitService.shareOutfit(id));
    }

    @DeleteMapping("/{id}/share")
    public ResponseEntity<OutfitResponse> unshareOutfit(@PathVariable Long id) {
        return ResponseEntity.ok(outfitService.unshareOutfit(id));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteOutfit(@PathVariable Long id) {
        outfitService.deleteOutfit(id);
        return ResponseEntity.noContent().build();
    }
}
