package com.javier.closetapp.user.service;

import com.javier.closetapp.common.enums.Role;
import com.javier.closetapp.exception.ForbiddenOperationException;
import com.javier.closetapp.exception.ResourceNotFoundException;
import com.javier.closetapp.outfit.entity.Outfit;
import com.javier.closetapp.outfit.repository.OutfitRepository;
import com.javier.closetapp.user.dto.UserResponse;
import com.javier.closetapp.user.dto.UserUpdateRequest;
import com.javier.closetapp.user.entity.User;
import com.javier.closetapp.user.repository.UserRepository;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
public class UserService {

    private final UserRepository userRepository;
    private final OutfitRepository outfitRepository;

    public UserService(UserRepository userRepository, OutfitRepository outfitRepository) {
        this.userRepository = userRepository;
        this.outfitRepository = outfitRepository;
    }

    public User getAuthenticatedUser() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("Authenticated user not found"));
    }

    public UserResponse getCurrentUserResponse() {
        return mapToResponse(getAuthenticatedUser());
    }

    @Transactional
    public UserResponse updateCurrentUser(UserUpdateRequest request) {
        User user = getAuthenticatedUser();
        
        if (request.getFirstName() != null) {
            user.setFirstName(request.getFirstName());
        }
        if (request.getLastName() != null) {
            user.setLastName(request.getLastName());
        }
        
        User updatedUser = userRepository.save(user);
        return mapToResponse(updatedUser);
    }

    // Makes one of the caller's own outfits their main outfit (Task 78). Same
    // 404 / 403 split as the other outfit operations: unknown id vs someone
    // else's outfit.
    @Transactional
    public UserResponse setMainOutfit(Long outfitId) {
        User user = getAuthenticatedUser();
        Outfit outfit = outfitRepository.findById(outfitId)
                .orElseThrow(() -> new ResourceNotFoundException("Outfit not found"));

        if (!outfit.getOwner().getUserId().equals(user.getUserId())) {
            throw new ForbiddenOperationException("Unauthorized to use this outfit");
        }

        user.setMainOutfitId(outfitId);
        return mapToResponse(userRepository.save(user));
    }

    @Transactional
    public UserResponse clearMainOutfit() {
        User user = getAuthenticatedUser();
        user.setMainOutfitId(null);
        return mapToResponse(userRepository.save(user));
    }

    @Transactional
    public void deactivateCurrentUser() {
        User user = getAuthenticatedUser();
        user.setActive(false);
        userRepository.save(user);
    }

    // Admin methods
    public List<UserResponse> getAllUsers() {
        return userRepository.findAll().stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    @Transactional
    public UserResponse deactivateUser(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));
        user.setActive(false);
        return mapToResponse(userRepository.save(user));
    }

    @Transactional
    public UserResponse reactivateUser(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));
        user.setActive(true);
        return mapToResponse(userRepository.save(user));
    }

    private UserResponse mapToResponse(User user) {
        return new UserResponse(
                user.getUserId(),
                user.getEmail(),
                user.getFirstName(),
                user.getLastName(),
                user.getRole(),
                user.isActive(),
                user.getCreatedAt(),
                user.getMainOutfitId()
        );
    }
}
