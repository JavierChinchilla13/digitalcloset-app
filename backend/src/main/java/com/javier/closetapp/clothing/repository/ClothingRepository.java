package com.javier.closetapp.clothing.repository;

import com.javier.closetapp.clothing.entity.ClothingItem;
import com.javier.closetapp.user.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

// Garments by owner. The app reads only through findByOwnerAndIsActiveTrue so soft-deleted ones never show.
@Repository
public interface ClothingRepository extends JpaRepository<ClothingItem, Long> {
    // The closet: excludes items the owner has deactivated via deleteItem() (soft delete).
    List<ClothingItem> findByOwnerAndIsActiveTrue(User owner);

    // Task 96: how many garments count against the owner's limit (soft-deleted ones free their slot).
    long countByOwnerAndIsActiveTrue(User owner);
}
