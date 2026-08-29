package com.javier.closetapp.clothing.controller;

import com.javier.closetapp.clothing.dto.ClothingRequest;
import com.javier.closetapp.clothing.dto.ClothingResponse;
import com.javier.closetapp.clothing.service.ClothingService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/clothing")
public class ClothingController {

    private final ClothingService clothingService;

    public ClothingController(ClothingService clothingService) {
        this.clothingService = clothingService;
    }

    @PostMapping
    public ResponseEntity<ClothingResponse> createItem(@Valid @RequestBody ClothingRequest request) {
        return ResponseEntity.ok(clothingService.createItem(request));
    }

    @GetMapping
    public ResponseEntity<List<ClothingResponse>> getAllItems() {
        return ResponseEntity.ok(clothingService.getAllItems());
    }

    // No @Valid here: ClothingService.updateItem() applies fields only when
    // non-null (partial update), so enforcing "required" constraints on this
    // same DTO would incorrectly reject legitimate partial payloads.
    @PutMapping("/{id}")
    public ResponseEntity<ClothingResponse> updateItem(@PathVariable Long id, @RequestBody ClothingRequest request) {
        return ResponseEntity.ok(clothingService.updateItem(id, request));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteItem(@PathVariable Long id) {
        clothingService.deleteItem(id);
        return ResponseEntity.noContent().build();
    }
}
