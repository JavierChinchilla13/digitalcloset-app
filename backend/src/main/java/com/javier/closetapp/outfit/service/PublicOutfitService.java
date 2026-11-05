package com.javier.closetapp.outfit.service;

import com.javier.closetapp.clothing.entity.ClothingItem;
import com.javier.closetapp.clothing.service.ClothingService;
import com.javier.closetapp.exception.ResourceNotFoundException;
import com.javier.closetapp.outfit.dto.PublicGarmentResponse;
import com.javier.closetapp.outfit.dto.PublicOutfitResponse;
import com.javier.closetapp.outfit.dto.PublicOutfitResponse.PublicOutfitItem;
import com.javier.closetapp.outfit.entity.Outfit;
import com.javier.closetapp.outfit.repository.OutfitRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

// Task 102: reads an outfit through its public share token, for visitors who are not signed in.
// An unknown token, a revoked one, an outfit whose owner deactivated the account: all the same 404,
// so a visitor cannot tell "never existed" from "turned off".
@Service
public class PublicOutfitService {

    private final OutfitRepository outfitRepository;
    private final ClothingService clothingService;

    public PublicOutfitService(OutfitRepository outfitRepository, ClothingService clothingService) {
        this.outfitRepository = outfitRepository;
        this.clothingService = clothingService;
    }

    @Transactional(readOnly = true)
    public PublicOutfitResponse getByToken(String token) {
        Outfit outfit = outfitRepository.findByShareToken(token)
                .filter(o -> o.getOwner() != null && o.getOwner().isActive())
                .orElseThrow(() -> new ResourceNotFoundException("This outfit is not shared"));

        // Garments the owner deleted (soft delete) are left out, like they are everywhere else.
        List<ClothingItem> live = outfit.getItems().stream()
                .map(item -> item.getClothingItem())
                .filter(c -> Boolean.TRUE.equals(c.getActive()))
                .toList();

        PublicOutfitResponse res = new PublicOutfitResponse();
        res.setName(outfit.getName());
        res.setAvatarType(outfit.getAvatarType());
        res.setItems(outfit.getItems().stream()
                .filter(item -> Boolean.TRUE.equals(item.getClothingItem().getActive()))
                .map(item -> new PublicOutfitItem(item.getClothingItem().getItemId(), item.getSlot(),
                        item.getItemOrder(), item.getLayerOrder()))
                .toList());
        res.setGarments(live.stream()
                .map(c -> PublicGarmentResponse.from(clothingService.mapToResponse(c)))
                .toList());
        return res;
    }
}
