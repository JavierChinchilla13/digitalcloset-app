package com.javier.closetapp.collection.controller;

import com.javier.closetapp.collection.dto.CollectionRequest;
import com.javier.closetapp.collection.dto.CollectionResponse;
import com.javier.closetapp.collection.service.CollectionService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

// Mirrors OutfitController's pattern. Ownership enforcement lives in
// CollectionService (Task 33), not here - this controller is a thin HTTP
// wrapper, consistent with ClothingController/OutfitController.
@RestController
@RequestMapping("/api/collections")
public class CollectionController {

    private final CollectionService collectionService;

    public CollectionController(CollectionService collectionService) {
        this.collectionService = collectionService;
    }

    @PostMapping
    public ResponseEntity<CollectionResponse> createCollection(@Valid @RequestBody CollectionRequest request) {
        return ResponseEntity.ok(collectionService.createCollection(request.getName()));
    }

    @GetMapping
    public ResponseEntity<List<CollectionResponse>> getAllCollections() {
        return ResponseEntity.ok(collectionService.getAllCollections());
    }

    @PutMapping("/{id}")
    public ResponseEntity<CollectionResponse> renameCollection(@PathVariable Long id, @Valid @RequestBody CollectionRequest request) {
        return ResponseEntity.ok(collectionService.renameCollection(id, request.getName()));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteCollection(@PathVariable Long id) {
        collectionService.deleteCollection(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/items/{itemId}")
    public ResponseEntity<CollectionResponse> addItem(@PathVariable Long id, @PathVariable Long itemId) {
        return ResponseEntity.ok(collectionService.addItemToCollection(id, itemId));
    }

    @DeleteMapping("/{id}/items/{itemId}")
    public ResponseEntity<CollectionResponse> removeItem(@PathVariable Long id, @PathVariable Long itemId) {
        return ResponseEntity.ok(collectionService.removeItemFromCollection(id, itemId));
    }

    @PostMapping("/{id}/outfits/{outfitId}")
    public ResponseEntity<CollectionResponse> addOutfit(@PathVariable Long id, @PathVariable Long outfitId) {
        return ResponseEntity.ok(collectionService.addOutfitToCollection(id, outfitId));
    }

    @DeleteMapping("/{id}/outfits/{outfitId}")
    public ResponseEntity<CollectionResponse> removeOutfit(@PathVariable Long id, @PathVariable Long outfitId) {
        return ResponseEntity.ok(collectionService.removeOutfitFromCollection(id, outfitId));
    }
}
