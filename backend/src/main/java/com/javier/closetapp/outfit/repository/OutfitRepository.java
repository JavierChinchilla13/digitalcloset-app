package com.javier.closetapp.outfit.repository;

import com.javier.closetapp.outfit.entity.Outfit;
import com.javier.closetapp.user.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

// Outfits by owner.
@Repository
public interface OutfitRepository extends JpaRepository<Outfit, Long> {
    List<Outfit> findByOwner(User owner);

    // Task 102: the outfit behind a public share link.
    Optional<Outfit> findByShareToken(String shareToken);

    // Audit H3: takes an outfit out of every category it is in (the membership rows point at it, so they must go
    // before the outfit can).
    @Modifying
    @Query("delete from CollectionOutfit co where co.outfit.outfitId = :outfitId")
    void deleteCollectionLinks(@Param("outfitId") Long outfitId);
}
