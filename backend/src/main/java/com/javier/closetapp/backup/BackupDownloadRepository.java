package com.javier.closetapp.backup;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface BackupDownloadRepository extends JpaRepository<BackupDownload, Long> {

    List<BackupDownload> findTop10ByOrderByIdDesc();

    List<BackupDownload> findTop50ByOrderByIdDesc();

    Optional<BackupDownload> findFirstByOkTrueOrderByIdDesc();

    // Finished downloads by one admin since `since` (the limits are also counted here so a restart cannot reset them).
    long countByAdminUserIdAndOkTrueAndDownloadedAtAfter(Long adminUserId, LocalDateTime since);

    void deleteByIdLessThan(Long id);
}
