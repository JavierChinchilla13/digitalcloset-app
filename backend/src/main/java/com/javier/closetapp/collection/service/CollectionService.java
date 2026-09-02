package com.javier.closetapp.collection.service;

import com.javier.closetapp.clothing.entity.ClothingItem;
import com.javier.closetapp.clothing.repository.ClothingRepository;
import com.javier.closetapp.collection.dto.CollectionItemResponse;
import com.javier.closetapp.collection.dto.CollectionOutfitResponse;
import com.javier.closetapp.collection.dto.CollectionResponse;
import com.javier.closetapp.collection.entity.Collection;
import com.javier.closetapp.collection.entity.CollectionItem;
import com.javier.closetapp.collection.entity.CollectionOutfit;
import com.javier.closetapp.collection.repository.CollectionRepository;
import com.javier.closetapp.exception.ForbiddenOperationException;
import com.javier.closetapp.exception.ResourceNotFoundException;
import com.javier.closetapp.outfit.entity.Outfit;
import com.javier.closetapp.outfit.repository.OutfitRepository;
import com.javier.closetapp.user.entity.User;
import com.javier.closetapp.user.repository.UserRepository;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.stream.Collectors;

// Business logic + ownership enforcement for Collections (Task 33/34).
@Service
public class CollectionService {

    private final CollectionRepository collectionRepository;
    private final ClothingRepository clothingRepository;
    private final OutfitRepository outfitRepository;
    private final UserRepository userRepository;

    public CollectionService(CollectionRepository collectionRepository,
                             ClothingRepository clothingRepository,
                             OutfitRepository outfitRepository,
                             UserRepository userRepository) {
        this.collectionRepository = collectionRepository;
        this.clothingRepository = clothingRepository;
        this.outfitRepository = outfitRepository;
        this.userRepository = userRepository;
    }

    private User getAuthenticatedUser() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepository.findByEmail(email).orElseThrow(() -> new RuntimeException("User not found"));
    }

    private Collection getOwnedCollection(Long collectionId, User user) {
        Collection collection = collectionRepository.findById(collectionId)
                .orElseThrow(() -> new ResourceNotFoundException("Collection not found"));

        if (!collection.getOwner().getUserId().equals(user.getUserId())) {
            throw new ForbiddenOperationException("Unauthorized to access this collection");
        }

        return collection;
    }

    @Transactional
    public CollectionResponse createCollection(String name) {
        User user = getAuthenticatedUser();
        Collection collection = new Collection();
        collection.setName(name);
        collection.setOwner(user);
        return mapToResponse(collectionRepository.save(collection));
    }

    public List<CollectionResponse> getAllCollections() {
        User user = getAuthenticatedUser();
        return collectionRepository.findByOwner(user).stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    @Transactional
    public CollectionResponse renameCollection(Long collectionId, String newName) {
        User user = getAuthenticatedUser();
        Collection collection = getOwnedCollection(collectionId, user);
        collection.setName(newName);
        return mapToResponse(collectionRepository.save(collection));
    }

    // Deletes the collection itself. Membership join rows (CollectionItem/
    // CollectionOutfit) cascade-delete with it via the entity mapping, but
    // the underlying ClothingItem/Outfit rows they reference are untouched -
    // they're a ManyToOne reference, not owned by the collection.
    @Transactional
    public void deleteCollection(Long collectionId) {
        User user = getAuthenticatedUser();
        Collection collection = getOwnedCollection(collectionId, user);
        collectionRepository.delete(collection);
    }

    @Transactional
    public CollectionResponse addItemToCollection(Long collectionId, Long itemId) {
        User user = getAuthenticatedUser();
        Collection collection = getOwnedCollection(collectionId, user);

        ClothingItem clothingItem = clothingRepository.findById(itemId)
                .orElseThrow(() -> new ResourceNotFoundException("Clothing item not found: " + itemId));
        if (!clothingItem.getOwner().getUserId().equals(user.getUserId())) {
            throw new ForbiddenOperationException("Unauthorized to use clothing item: " + itemId);
        }

        boolean alreadyMember = collection.getItems().stream()
                .anyMatch(ci -> ci.getClothingItem().getItemId().equals(itemId));
        if (!alreadyMember) {
            CollectionItem collectionItem = new CollectionItem();
            collectionItem.setCollection(collection);
            collectionItem.setClothingItem(clothingItem);
            collection.getItems().add(collectionItem);
            collectionRepository.save(collection);
        }

        return mapToResponse(collection);
    }

    @Transactional
    public CollectionResponse removeItemFromCollection(Long collectionId, Long itemId) {
        User user = getAuthenticatedUser();
        Collection collection = getOwnedCollection(collectionId, user);

        collection.getItems().removeIf(ci -> ci.getClothingItem().getItemId().equals(itemId));
        return mapToResponse(collectionRepository.save(collection));
    }

    @Transactional
    public CollectionResponse addOutfitToCollection(Long collectionId, Long outfitId) {
        User user = getAuthenticatedUser();
        Collection collection = getOwnedCollection(collectionId, user);

        Outfit outfit = outfitRepository.findById(outfitId)
                .orElseThrow(() -> new ResourceNotFoundException("Outfit not found: " + outfitId));
        if (!outfit.getOwner().getUserId().equals(user.getUserId())) {
            throw new ForbiddenOperationException("Unauthorized to use outfit: " + outfitId);
        }

        boolean alreadyMember = collection.getOutfits().stream()
                .anyMatch(co -> co.getOutfit().getOutfitId().equals(outfitId));
        if (!alreadyMember) {
            CollectionOutfit collectionOutfit = new CollectionOutfit();
            collectionOutfit.setCollection(collection);
            collectionOutfit.setOutfit(outfit);
            collection.getOutfits().add(collectionOutfit);
            collectionRepository.save(collection);
        }

        return mapToResponse(collection);
    }

    @Transactional
    public CollectionResponse removeOutfitFromCollection(Long collectionId, Long outfitId) {
        User user = getAuthenticatedUser();
        Collection collection = getOwnedCollection(collectionId, user);

        collection.getOutfits().removeIf(co -> co.getOutfit().getOutfitId().equals(outfitId));
        return mapToResponse(collectionRepository.save(collection));
    }

    private CollectionResponse mapToResponse(Collection collection) {
        CollectionResponse res = new CollectionResponse();
        res.setCollectionId(collection.getCollectionId());
        res.setName(collection.getName());

        LocalDateTime createdAt = collection.getCreatedAt();
        if (createdAt != null) {
            res.setCreatedAt(createdAt.format(DateTimeFormatter.ISO_LOCAL_DATE_TIME));
        }

        res.setItems(collection.getItems().stream().map(ci -> {
            CollectionItemResponse itemRes = new CollectionItemResponse();
            itemRes.setCollectionItemId(ci.getCollectionItemId());
            itemRes.setItemId(ci.getClothingItem().getItemId());
            itemRes.setItemName(ci.getClothingItem().getName());
            itemRes.setImageUrl(ci.getClothingItem().getImageUrl());
            return itemRes;
        }).collect(Collectors.toList()));

        res.setOutfits(collection.getOutfits().stream().map(co -> {
            CollectionOutfitResponse outfitRes = new CollectionOutfitResponse();
            outfitRes.setCollectionOutfitId(co.getCollectionOutfitId());
            outfitRes.setOutfitId(co.getOutfit().getOutfitId());
            outfitRes.setOutfitName(co.getOutfit().getName());
            return outfitRes;
        }).collect(Collectors.toList()));

        return res;
    }
}
