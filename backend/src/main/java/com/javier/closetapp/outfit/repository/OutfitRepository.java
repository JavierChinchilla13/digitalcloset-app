package com.javier.closetapp.outfit.repository;

import com.javier.closetapp.outfit.entity.Outfit;
import com.javier.closetapp.user.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

// Outfits by owner.
@Repository
public interface OutfitRepository extends JpaRepository<Outfit, Long> {
    List<Outfit> findByOwner(User owner);
}
