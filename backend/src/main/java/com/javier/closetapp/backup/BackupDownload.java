package com.javier.closetapp.backup;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.LocalDateTime;

// One row of the backup log (the last 50 are kept). No email, name or IP: see V20.
@Entity
@Table(name = "backup_downloads")
public class BackupDownload {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "downloaded_at", nullable = false)
    private LocalDateTime downloadedAt;

    @Column(name = "admin_user_id", nullable = false)
    private Long adminUserId;

    @Column(nullable = false)
    private long bytes;

    @Column(nullable = false)
    private boolean ok;

    @Column(name = "alert_sent", nullable = false)
    private boolean alertSent;

    protected BackupDownload() { }

    public BackupDownload(LocalDateTime downloadedAt, Long adminUserId, long bytes, boolean ok, boolean alertSent) {
        this.downloadedAt = downloadedAt;
        this.adminUserId = adminUserId;
        this.bytes = bytes;
        this.ok = ok;
        this.alertSent = alertSent;
    }

    public Long getId() { return id; }
    public LocalDateTime getDownloadedAt() { return downloadedAt; }
    public Long getAdminUserId() { return adminUserId; }
    public long getBytes() { return bytes; }
    public boolean isOk() { return ok; }
    public boolean isAlertSent() { return alertSent; }
}
