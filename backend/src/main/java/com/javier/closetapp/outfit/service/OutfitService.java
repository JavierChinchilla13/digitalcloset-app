package com.javier.closetapp.outfit.service;

import com.javier.closetapp.clothing.entity.ClothingItem;
import com.javier.closetapp.clothing.repository.ClothingRepository;
import com.javier.closetapp.exception.ForbiddenOperationException;
import com.javier.closetapp.exception.InvalidOutfitException;
import com.javier.closetapp.exception.ResourceNotFoundException;
import com.javier.closetapp.outfit.dto.*;
import com.javier.closetapp.outfit.entity.Outfit;
import com.javier.closetapp.outfit.entity.OutfitItem;
import com.javier.closetapp.outfit.repository.OutfitRepository;
import com.javier.closetapp.user.entity.User;
import com.javier.closetapp.user.repository.UserRepository;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
public class OutfitService {

    private final OutfitRepository outfitRepository;
    private final ClothingRepository clothingRepository;
    private final UserRepository userRepository;

    public OutfitService(OutfitRepository outfitRepository, 
                         ClothingRepository clothingRepository, 
                         UserRepository userRepository) {
        this.outfitRepository = outfitRepository;
        this.clothingRepository = clothingRepository;
        this.userRepository = userRepository;
    }

    private User getAuthenticatedUser() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepository.findByEmail(email).orElseThrow(() -> new RuntimeException("User not found"));
    }

    // One shoe per foot (Task 86): an outfit may name at most one leftShoe and
    // one rightShoe. Shoes saved without a side have no slot and can't be
    // checked here (the app treats such a shoe as a pair and keeps one).
    private void validateShoeSlots(OutfitRequest request) {
        long left = request.getItems().stream().filter(i -> "leftShoe".equals(i.getSlot())).count();
        long right = request.getItems().stream().filter(i -> "rightShoe".equals(i.getSlot())).count();
        if (left > 1 || right > 1) {
            throw new InvalidOutfitException("An outfit can have only one shoe per foot.");
        }
    }

    @Transactional
    public OutfitResponse saveOutfit(OutfitRequest request) {
        validateShoeSlots(request);
        User user = getAuthenticatedUser();
        Outfit outfit = new Outfit();
        outfit.setName(request.getName());
        outfit.setDescription(request.getDescription());
        outfit.setAvatarType(request.getAvatarType());
        outfit.setOwner(user);

        List<OutfitItem> items = request.getItems().stream().map(itemReq -> {
            ClothingItem clothing = clothingRepository.findById(itemReq.getItemId())
                    .orElseThrow(() -> new ResourceNotFoundException("Clothing item not found: " + itemReq.getItemId()));

            if (!clothing.getOwner().getUserId().equals(user.getUserId())) {
                throw new ForbiddenOperationException("Unauthorized to use clothing item: " + itemReq.getItemId());
            }

            OutfitItem item = new OutfitItem();
            item.setOutfit(outfit);
            item.setClothingItem(clothing);
            item.setSlot(itemReq.getSlot());
            item.setItemOrder(itemReq.getItemOrder());
            item.setLayerOrder(itemReq.getLayerOrder());
            return item;
        }).collect(Collectors.toList());

        outfit.setItems(items);
        Outfit saved = outfitRepository.save(outfit);

        // A user's first outfit becomes their main outfit automatically (Task
        // 78), so the Showcase and Attire have something sensible to open on.
        // Later outfits never replace it - that is an explicit choice.
        if (user.getMainOutfitId() == null) {
            user.setMainOutfitId(saved.getOutfitId());
            userRepository.save(user);
        }

        return mapToResponse(saved);
    }

    @Transactional
    public OutfitResponse updateOutfit(Long id, OutfitRequest request) {
        validateShoeSlots(request);
        User user = getAuthenticatedUser();
        Outfit outfit = outfitRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Outfit not found"));

        if (!outfit.getOwner().getUserId().equals(user.getUserId())) {
            throw new ForbiddenOperationException("Unauthorized to update this outfit");
        }

        outfit.setName(request.getName());
        outfit.setDescription(request.getDescription());
        outfit.setAvatarType(request.getAvatarType());

        // Clear existing items and add new ones
        outfit.getItems().clear();
        
        List<OutfitItem> items = request.getItems().stream().map(itemReq -> {
            ClothingItem clothing = clothingRepository.findById(itemReq.getItemId())
                    .orElseThrow(() -> new ResourceNotFoundException("Clothing item not found: " + itemReq.getItemId()));

            if (!clothing.getOwner().getUserId().equals(user.getUserId())) {
                throw new ForbiddenOperationException("Unauthorized to use clothing item: " + itemReq.getItemId());
            }

            OutfitItem item = new OutfitItem();
            item.setOutfit(outfit);
            item.setClothingItem(clothing);
            item.setSlot(itemReq.getSlot());
            item.setItemOrder(itemReq.getItemOrder());
            item.setLayerOrder(itemReq.getLayerOrder());
            return item;
        }).collect(Collectors.toList());

        outfit.getItems().addAll(items);
        
        Outfit updated = outfitRepository.save(outfit);
        return mapToResponse(updated);
    }

    public List<OutfitResponse> getAllOutfits() {
        User user = getAuthenticatedUser();
        return outfitRepository.findByOwner(user).stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    @Transactional
    public void deleteOutfit(Long id) {
        User user = getAuthenticatedUser();
        Outfit outfit = outfitRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Outfit not found"));

        if (!outfit.getOwner().getUserId().equals(user.getUserId())) {
            throw new ForbiddenOperationException("Unauthorized to delete this outfit");
        }

        // Deleting the main outfit leaves the user with none (the FK's ON DELETE
        // SET NULL does the same in Postgres; clearing it here keeps the entity
        // in step and works on any database).
        if (id.equals(user.getMainOutfitId())) {
            user.setMainOutfitId(null);
            userRepository.save(user);
        }

        outfitRepository.delete(outfit);
    }

    private OutfitResponse mapToResponse(Outfit outfit) {
        OutfitResponse res = new OutfitResponse();
        res.setOutfitId(outfit.getOutfitId());
        res.setName(outfit.getName());
        res.setDescription(outfit.getDescription());
        res.setAvatarType(outfit.getAvatarType());
        res.setItems(outfit.getItems().stream().map(item -> {
            OutfitItemResponse itemRes = new OutfitItemResponse();
            itemRes.setOutfitItemId(item.getOutfitItemId());
            itemRes.setItemId(item.getClothingItem().getItemId());
            itemRes.setItemName(item.getClothingItem().getName());
            itemRes.setImageUrl(item.getClothingItem().getImageUrl());
            itemRes.setSlot(item.getSlot());
            itemRes.setItemOrder(item.getItemOrder());
            itemRes.setLayerOrder(item.getLayerOrder());
            return itemRes;
        }).collect(Collectors.toList()));
        return res;
    }
}
