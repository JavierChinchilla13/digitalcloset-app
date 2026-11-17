package com.javier.closetapp.backup;

import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.List;

// The backup log: records a download and keeps only the last 50 rows. Separate from BackupService so each call is its own short
// transaction (the long archive build must never sit inside a database transaction).
@Component
public class BackupDownloadLog {

    static final int KEEP = 50;

    private final BackupDownloadRepository repository;

    public BackupDownloadLog(BackupDownloadRepository repository) {
        this.repository = repository;
    }

    @Transactional
    public void record(long adminUserId, long bytes, boolean ok, boolean alertSent) {
        repository.save(new BackupDownload(LocalDateTime.now(ZoneOffset.UTC), adminUserId, bytes, ok, alertSent));
        List<BackupDownload> newest = repository.findTop50ByOrderByIdDesc();
        if (newest.size() >= KEEP) repository.deleteByIdLessThan(newest.get(KEEP - 1).getId());
    }

    @Transactional(readOnly = true)
    public long finishedSince(long adminUserId, LocalDateTime since) {
        return repository.countByAdminUserIdAndOkTrueAndDownloadedAtAfter(adminUserId, since);
    }

    @Transactional(readOnly = true)
    public List<BackupDownload> recent() {
        return repository.findTop10ByOrderByIdDesc();
    }

    @Transactional(readOnly = true)
    public LocalDateTime lastFinished() {
        return repository.findFirstByOkTrueOrderByIdDesc().map(BackupDownload::getDownloadedAt).orElse(null);
    }
}
