package com.javier.closetapp.outfit.controller;

import com.javier.closetapp.outfit.dto.PublicOutfitResponse;
import com.javier.closetapp.outfit.service.PublicOutfitService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

// Task 102: the one anonymous read endpoint of the outfit API - /api/public/outfits/{token} - used by
// the shared-outfit page. SecurityConfig lets GET /api/public/** through without a login, and
// RateLimitFilter gives it its own per-address limit.
@RestController
@RequestMapping("/api/public/outfits")
public class PublicOutfitController {

    private final PublicOutfitService publicOutfitService;

    public PublicOutfitController(PublicOutfitService publicOutfitService) {
        this.publicOutfitService = publicOutfitService;
    }

    @GetMapping("/{token}")
    public ResponseEntity<PublicOutfitResponse> getSharedOutfit(@PathVariable String token) {
        return ResponseEntity.ok(publicOutfitService.getByToken(token));
    }
}
