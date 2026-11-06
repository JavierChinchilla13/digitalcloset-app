package com.javier.closetapp.collection.repository;

import com.javier.closetapp.collection.entity.Collection;
import com.javier.closetapp.user.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

// Categories by owner.
@Repository
public interface CollectionRepository extends JpaRepository<Collection, Long> {
    List<Collection> findByOwner(User owner);

    // Audit M9: the owner's category with this name, ignoring capitals (the database has the same rule).
    java.util.Optional<Collection> findFirstByOwnerAndNameIgnoreCase(User owner, String name);
}
