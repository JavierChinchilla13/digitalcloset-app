package com.javier.closetapp.clothing.repository;

import com.javier.closetapp.clothing.entity.ClothingItem;
import com.javier.closetapp.common.enums.ClothingCategory;
import com.javier.closetapp.user.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ClothingRepository extends JpaRepository<ClothingItem, Long> {
    List<ClothingItem> findByOwner(User owner);
    List<ClothingItem> findByOwnerAndCategory(User owner, ClothingCategory category);

    // Used by soft-delete: excludes items the owner has deactivated via deleteItem().
    List<ClothingItem> findByOwnerAndIsActiveTrue(User owner);
}
