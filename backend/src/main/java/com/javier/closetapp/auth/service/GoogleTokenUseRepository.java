package com.javier.closetapp.auth.service;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;

@Repository
public interface GoogleTokenUseRepository extends JpaRepository<GoogleTokenUse, String> {

    void deleteByUsedAtBefore(LocalDateTime cutoff);
}
