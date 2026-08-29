package com.javier.closetapp.outfit.service;

import com.javier.closetapp.clothing.entity.ClothingItem;
import com.javier.closetapp.clothing.repository.ClothingRepository;
import com.javier.closetapp.exception.ForbiddenOperationException;
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

    @Transactional
    public OutfitResponse saveOutfit(OutfitRequest request) {
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
            item.setPositionX(itemReq.getPositionX());
            item.setPositionY(itemReq.getPositionY());
            item.setScaleX(itemReq.getScaleX());
            item.setScaleY(itemReq.getScaleY());
            item.setRotation(itemReq.getRotation());
            return item;
        }).collect(Collectors.toList());

        outfit.setItems(items);
        Outfit saved = outfitRepository.save(outfit);
        return mapToResponse(saved);
    }

    @Transactional
    public OutfitResponse updateOutfit(Long id, OutfitRequest request) {
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
            item.setPositionX(itemReq.getPositionX());
            item.setPositionY(itemReq.getPositionY());
            item.setScaleX(itemReq.getScaleX());
            item.setScaleY(itemReq.getScaleY());
            item.setRotation(itemReq.getRotation());
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
            itemRes.setPositionX(item.getPositionX());
            itemRes.setPositionY(item.getPositionY());
            itemRes.setScaleX(item.getScaleX());
            itemRes.setScaleY(item.getScaleY());
            itemRes.setRotation(item.getRotation());
            return itemRes;
        }).collect(Collectors.toList()));
        return res;
    }
}
