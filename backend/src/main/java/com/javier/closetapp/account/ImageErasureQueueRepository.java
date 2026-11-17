package com.javier.closetapp.account;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

// The pictures waiting to be removed from the image provider (see ImageErasureQueueEntry).
@Repository
public interface ImageErasureQueueRepository extends JpaRepository<ImageErasureQueueEntry, Long> {
    boolean existsByImageUrl(String imageUrl);
}
