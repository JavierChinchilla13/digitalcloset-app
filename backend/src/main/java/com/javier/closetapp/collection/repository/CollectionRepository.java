package com.javier.closetapp.collection.repository;

import com.javier.closetapp.collection.entity.Collection;
import com.javier.closetapp.user.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface CollectionRepository extends JpaRepository<Collection, Long> {
    List<Collection> findByOwner(User owner);
}
