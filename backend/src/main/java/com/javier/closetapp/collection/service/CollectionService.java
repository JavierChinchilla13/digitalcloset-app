package com.javier.closetapp.collection.service;

import com.javier.closetapp.clothing.entity.ClothingItem;
import com.javier.closetapp.clothing.repository.ClothingRepository;
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

import java.util.List;

// Business logic + ownership enforcement for Collections (Task 33). DTOs
// and the REST controller are Task 34 - this layer returns plain entities,
// following the same shape ClothingService/OutfitService had before their
// own DTOs existed.
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
    public Collection createCollection(String name) {
        User user = getAuthenticatedUser();
        Collection collection = new Collection();
        collection.setName(name);
        collection.setOwner(user);
        return collectionRepository.save(collection);
    }

    public List<Collection> getAllCollections() {
        User user = getAuthenticatedUser();
        return collectionRepository.findByOwner(user);
    }

    @Transactional
    public Collection renameCollection(Long collectionId, String newName) {
        User user = getAuthenticatedUser();
        Collection collection = getOwnedCollection(collectionId, user);
        collection.setName(newName);
        return collectionRepository.save(collection);
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
    public Collection addItemToCollection(Long collectionId, Long itemId) {
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

        return collection;
    }

    @Transactional
    public Collection removeItemFromCollection(Long collectionId, Long itemId) {
        User user = getAuthenticatedUser();
        Collection collection = getOwnedCollection(collectionId, user);

        collection.getItems().removeIf(ci -> ci.getClothingItem().getItemId().equals(itemId));
        return collectionRepository.save(collection);
    }

    @Transactional
    public Collection addOutfitToCollection(Long collectionId, Long outfitId) {
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

        return collection;
    }

    @Transactional
    public Collection removeOutfitFromCollection(Long collectionId, Long outfitId) {
        User user = getAuthenticatedUser();
        Collection collection = getOwnedCollection(collectionId, user);

        collection.getOutfits().removeIf(co -> co.getOutfit().getOutfitId().equals(outfitId));
        return collectionRepository.save(collection);
    }
}
