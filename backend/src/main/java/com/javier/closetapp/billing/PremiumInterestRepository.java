package com.javier.closetapp.billing;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface PremiumInterestRepository extends JpaRepository<PremiumInterest, Long> {

    Optional<PremiumInterest> findByUserId(Long userId);

    Optional<PremiumInterest> findFirstByOrderByCreatedAtDesc();

    void deleteByUserId(Long userId);
}
