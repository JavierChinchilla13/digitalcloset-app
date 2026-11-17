package com.javier.closetapp.account;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.javier.closetapp.auth.repository.PasswordResetTokenRepository;
import com.javier.closetapp.billing.BillingService;
import com.javier.closetapp.clothing.entity.ClothingItem;
import com.javier.closetapp.clothing.repository.ClothingRepository;
import com.javier.closetapp.clothing.service.ImageUrlPolicy;
import com.javier.closetapp.collection.repository.CollectionRepository;
import com.javier.closetapp.outfit.repository.OutfitRepository;
import com.javier.closetapp.persona.repository.PersonaDisplayNameRepository;
import com.javier.closetapp.user.entity.User;
import com.javier.closetapp.user.repository.PendingAccountChangeRepository;
import com.javier.closetapp.user.repository.UserRepository;
import jakarta.persistence.EntityManager;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

// Audit H12: REAL erasure of an account and everything in it (not deactivation). Used when someone deletes their account and
// when an existing account turns out to be under the minimum age. Nothing is kept about the person.
//
// What is erased, in one transaction: the categories (and their links), the outfits (and their pieces and share links, so a
// public link then answers "not found"), every garment (including the ones they had already deleted), the persona names, any
// pending password/email change and reset token, and the account itself. Then, outside the database:
//  - Stripe: the subscription is cancelled and the customer deleted, best effort (Stripe keeps the payment records it must keep);
//  - pictures: the API cannot delete them (the upload preset is public and the server has no Cloudinary secret), so their addresses
//    go into image_erasure_queue WITHOUT any link to the person, and the owner empties the queue with scripts/purge-cloudinary.sh.
@Service
public class AccountErasureService {

    private final UserRepository userRepository;
    private final CollectionRepository collectionRepository;
    private final OutfitRepository outfitRepository;
    private final ClothingRepository clothingRepository;
    private final PersonaDisplayNameRepository personaDisplayNameRepository;
    private final PasswordResetTokenRepository passwordResetTokenRepository;
    private final PendingAccountChangeRepository pendingChangeRepository;
    private final ImageErasureQueueRepository imageQueue;
    private final BillingService billingService;
    private final ImageUrlPolicy imageUrlPolicy;
    private final ObjectMapper objectMapper;
    private final EntityManager entityManager;

    public AccountErasureService(UserRepository userRepository, CollectionRepository collectionRepository,
                                 OutfitRepository outfitRepository, ClothingRepository clothingRepository,
                                 PersonaDisplayNameRepository personaDisplayNameRepository,
                                 PasswordResetTokenRepository passwordResetTokenRepository,
                                 PendingAccountChangeRepository pendingChangeRepository,
                                 ImageErasureQueueRepository imageQueue, BillingService billingService,
                                 ImageUrlPolicy imageUrlPolicy, ObjectMapper objectMapper, EntityManager entityManager) {
        this.userRepository = userRepository;
        this.collectionRepository = collectionRepository;
        this.outfitRepository = outfitRepository;
        this.clothingRepository = clothingRepository;
        this.personaDisplayNameRepository = personaDisplayNameRepository;
        this.passwordResetTokenRepository = passwordResetTokenRepository;
        this.pendingChangeRepository = pendingChangeRepository;
        this.imageQueue = imageQueue;
        this.billingService = billingService;
        this.imageUrlPolicy = imageUrlPolicy;
        this.objectMapper = objectMapper;
        this.entityManager = entityManager;
    }

    // Erases the account and all its data. The caller has already checked who is asking and that they mean it.
    @Transactional
    public void erase(User user) {
        Long userId = user.getUserId();

        // Outside the database first (best effort; neither can block the erasure).
        billingService.cancelSubscriptionQuietly(user);
        billingService.deleteStripeCustomerQuietly(user);

        List<ClothingItem> garments = clothingRepository.findByOwner(user);
        queuePictures(garments);

        // The main-outfit pointer first, then the data from the leaves up: links, then the things they point at.
        user.setMainOutfitId(null);
        userRepository.save(user);
        entityManager.flush();

        collectionRepository.deleteAll(collectionRepository.findByOwner(user));   // cascades to its item and outfit links
        entityManager.flush();
        outfitRepository.deleteAll(outfitRepository.findByOwner(user));            // cascades to its pieces; the share token goes with the row
        entityManager.flush();
        clothingRepository.deleteAll(garments);
        entityManager.flush();
        personaDisplayNameRepository.deleteAll(personaDisplayNameRepository.findByOwner(user));
        passwordResetTokenRepository.deleteAllByUserId(userId);
        pendingChangeRepository.deleteAllByUserId(userId);
        entityManager.flush();

        userRepository.delete(user);
        entityManager.flush();
    }

    // Writes the addresses of the person's Cloudinary pictures (the garment pictures and the ones inside jacket data) to the
    // queue, once each. Only addresses on the allowed image host are queued: nothing else is something we could remove.
    private void queuePictures(List<ClothingItem> garments) {
        Set<String> urls = new LinkedHashSet<>();
        for (ClothingItem garment : garments) {
            addIfQueueable(urls, garment.getImageUrl());
            collectPictureUrls(garment.getModularData(), urls);
        }
        for (String url : urls) {
            if (!imageQueue.existsByImageUrl(url)) {
                imageQueue.save(new ImageErasureQueueEntry(url));
            }
        }
    }

    // A jacket keeps the pictures of its parts as JSON; every text value that is an allowed picture address is queued.
    private void collectPictureUrls(String json, Set<String> urls) {
        if (json == null || json.isBlank()) return;
        try {
            walk(objectMapper.readTree(json), urls);
        } catch (JsonProcessingException ignored) {
            // Not JSON: nothing to read from it.
        }
    }

    private void walk(JsonNode node, Set<String> urls) {
        if (node == null) return;
        if (node.isTextual()) {
            addIfQueueable(urls, node.asText());
        } else if (node.isContainerNode()) {
            node.forEach(child -> walk(child, urls));
        }
    }

    private void addIfQueueable(Set<String> urls, String url) {
        if (url != null && url.startsWith("http") && imageUrlPolicy.isAllowed(url)) {
            urls.add(url);
        }
    }
}
