package com.javier.closetapp.clothing.service;

import com.javier.closetapp.clothing.dto.ClothingRequest;
import com.javier.closetapp.clothing.dto.ClothingResponse;
import com.javier.closetapp.clothing.dto.ClothingTransformDTO;
import com.javier.closetapp.clothing.entity.ClothingItem;
import com.javier.closetapp.clothing.repository.ClothingRepository;
import com.javier.closetapp.common.enums.PersonaStatus;
import com.javier.closetapp.exception.ForbiddenOperationException;
import com.javier.closetapp.exception.GarmentLimitExceededException;
import com.javier.closetapp.exception.ResourceNotFoundException;
import com.javier.closetapp.user.entity.User;
import com.javier.closetapp.user.repository.UserRepository;
import com.javier.closetapp.user.service.PlanLimits;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

// Garment CRUD for the signed-in user. Every method works on the caller's own rows only:
// reading is limited to the owner, and changing or deleting someone else's item is a 403.
@Service
public class ClothingService {

    private final ClothingRepository clothingRepository;
    private final UserRepository userRepository;
    private final PlanLimits planLimits;

    public ClothingService(ClothingRepository clothingRepository, UserRepository userRepository, PlanLimits planLimits) {
        this.clothingRepository = clothingRepository;
        this.userRepository = userRepository;
        this.planLimits = planLimits;
    }

    // The account behind the current request's token (set by JwtAuthenticationFilter).
    private User getAuthenticatedUser() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepository.findByEmail(email).orElseThrow(() -> new RuntimeException("User not found"));
    }

    // Saves a new garment owned by the caller; an omitted persona status defaults to FITTED, an omitted modular flag to false.
    // Task 96: refused with GarmentLimitExceededException when the account already holds its limit (15 free,
    // 300 premium, unlimited for admins). The account row is locked first, so concurrent requests are counted
    // one after the other and cannot slip past the limit. The limit only stops NEW garments: an account that
    // is already over it (say, after a plan change) keeps what it has.
    @Transactional
    public ClothingResponse createItem(ClothingRequest request) {
        User user = userRepository.findByIdForUpdate(getAuthenticatedUser().getUserId())
                .orElseThrow(() -> new RuntimeException("User not found"));
        Integer limit = planLimits.garmentLimit(user);
        if (limit != null && clothingRepository.countByOwnerAndIsActiveTrue(user) >= limit) {
            throw new GarmentLimitExceededException(limit, user.getPlan());
        }
        ClothingItem item = new ClothingItem();
        item.setName(request.getName());
        item.setDescription(request.getDescription());
        item.setCategory(request.getCategory());
        item.setImageUrl(request.getImageUrl());
        item.setSide(request.getSide());
        item.setIsModular(request.getIsModular() != null ? request.getIsModular() : false);
        item.setModularData(request.getModularData());
        item.setPersonaType(request.getPersonaType());
        item.setPersonaStatus(request.getPersonaStatus() != null ? request.getPersonaStatus() : PersonaStatus.FITTED);
        
        if (request.getTransform() != null) {
            item.setTransformX(request.getTransform().getX());
            item.setTransformY(request.getTransform().getY());
            item.setTransformScale(request.getTransform().getScale());
            item.setTransformScaleX(request.getTransform().getScaleX());
            item.setTransformScaleY(request.getTransform().getScaleY());
            item.setTransformRotation(request.getTransform().getRotation());
            item.setTransformWidth(request.getTransform().getWidth());
            item.setTransformHeight(request.getTransform().getHeight());
            item.setTransformOpacity(request.getTransform().getOpacity());
            item.setTransformFlipX(request.getTransform().getFlipX());
            item.setTransformFlipY(request.getTransform().getFlipY());
            item.setMaskTop(request.getTransform().getMaskTop());
            item.setMaskLeft(request.getTransform().getMaskLeft());
            item.setMaskWidth(request.getTransform().getMaskWidth());
            item.setMaskHeight(request.getTransform().getMaskHeight());
        }
        
        item.setOwner(user);

        ClothingItem saved = clothingRepository.save(item);
        return mapToResponse(saved);
    }

    // Only returns items the owner hasn't soft-deleted (isActive=true).
    public List<ClothingResponse> getAllItems() {
        User user = getAuthenticatedUser();
        return clothingRepository.findByOwnerAndIsActiveTrue(user).stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    // Partial update: only the fields present in the request change. A transform, if sent, replaces
    // the whole stored transform and mask. Note that `side` is set at creation only and is not
    // updatable here.
    @Transactional
    public ClothingResponse updateItem(Long id, ClothingRequest request) {
        User user = getAuthenticatedUser();
        ClothingItem item = clothingRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Item not found"));

        if (!item.getOwner().getUserId().equals(user.getUserId())) {
            throw new ForbiddenOperationException("Unauthorized to update this item");
        }

        if (request.getName() != null) {
            item.setName(request.getName());
        }
        if (request.getDescription() != null) {
            item.setDescription(request.getDescription());
        }
        if (request.getCategory() != null) {
            item.setCategory(request.getCategory());
        }
        if (request.getImageUrl() != null) {
            item.setImageUrl(request.getImageUrl());
        }
        if (request.getPersonaType() != null) {
            item.setPersonaType(request.getPersonaType());
        }
        if (request.getIsModular() != null) {
            item.setIsModular(request.getIsModular());
        }
        if (request.getModularData() != null) {
            item.setModularData(request.getModularData());
        }
        if (request.getPersonaStatus() != null) {
            item.setPersonaStatus(request.getPersonaStatus());
        }
        if (request.getTransform() != null) {
            item.setTransformX(request.getTransform().getX());
            item.setTransformY(request.getTransform().getY());
            item.setTransformScale(request.getTransform().getScale());
            item.setTransformScaleX(request.getTransform().getScaleX());
            item.setTransformScaleY(request.getTransform().getScaleY());
            item.setTransformRotation(request.getTransform().getRotation());
            item.setTransformWidth(request.getTransform().getWidth());
            item.setTransformHeight(request.getTransform().getHeight());
            item.setTransformOpacity(request.getTransform().getOpacity());
            item.setTransformFlipX(request.getTransform().getFlipX());
            item.setTransformFlipY(request.getTransform().getFlipY());
            item.setMaskTop(request.getTransform().getMaskTop());
            item.setMaskLeft(request.getTransform().getMaskLeft());
            item.setMaskWidth(request.getTransform().getMaskWidth());
            item.setMaskHeight(request.getTransform().getMaskHeight());
        }

        ClothingItem updated = clothingRepository.save(item);
        return mapToResponse(updated);
    }

    // Soft-delete: marks the item inactive instead of removing the row, so outfits
    // that still reference it aren't orphaned.
    @Transactional
    public void deleteItem(Long id) {
        User user = getAuthenticatedUser();
        ClothingItem item = clothingRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Item not found"));

        if (!item.getOwner().getUserId().equals(user.getUserId())) {
            throw new ForbiddenOperationException("Unauthorized to delete this item");
        }

        item.setActive(false);
        clothingRepository.save(item);
    }

    // Entity -> response, rebuilding the nested transform object the frontend expects.
    private ClothingResponse mapToResponse(ClothingItem item) {
        LocalDateTime createdAt = item.getCreatedAt();
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
        
        String formattedDate = createdAt.format(java.time.format.DateTimeFormatter.ISO_LOCAL_DATE_TIME);

        ClothingTransformDTO transform = new ClothingTransformDTO(
                item.getTransformX(),
                item.getTransformY(),
                item.getTransformScale(),
                item.getTransformRotation(),
                item.getTransformWidth(),
                item.getTransformHeight()
        );
        transform.setScaleX(item.getTransformScaleX());
        transform.setScaleY(item.getTransformScaleY());
        transform.setOpacity(item.getTransformOpacity());
        transform.setFlipX(item.getTransformFlipX());
        transform.setFlipY(item.getTransformFlipY());
        transform.setMaskTop(item.getMaskTop());
        transform.setMaskLeft(item.getMaskLeft());
        transform.setMaskWidth(item.getMaskWidth());
        transform.setMaskHeight(item.getMaskHeight());

        return new ClothingResponse(
                item.getItemId(),
                item.getName(),
                item.getDescription(),
                item.getCategory(),
                item.getImageUrl(),
                item.getSide(),
                item.getIsModular(),
                item.getModularData(),
                item.getPersonaType(),
                transform,
                item.getActive(),
                formattedDate,
                item.getPersonaStatus()
        );
    }
}
