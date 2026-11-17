package com.javier.closetapp.backup;

import com.javier.closetapp.user.service.UserService;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import org.springframework.http.MediaType;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.io.IOException;
import java.io.OutputStream;
import java.time.Duration;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.List;

// Admin-only. The download is a POST (never a GET: the proof and the archive password travel in the body, and a GET would be cached and
// logged by proxies), and the response is the encrypted archive streamed as an attachment, never cached.
@RestController
@RequestMapping("/api/admin/backup")
@PreAuthorize("hasRole('ADMIN')")
public class BackupController {

    public record Item(LocalDateTime downloadedAt, long bytes, boolean ok, boolean alertSent, long adminUserId) { }

    // lastBackupAt / daysSinceLastBackup are null when there has never been a finished download.
    public record Status(LocalDateTime lastBackupAt, Long daysSinceLastBackup, List<Item> recent) { }

    private final BackupService backupService;
    private final BackupDownloadLog downloadLog;
    private final UserService userService;

    public BackupController(BackupService backupService, BackupDownloadLog downloadLog, UserService userService) {
        this.backupService = backupService;
        this.downloadLog = downloadLog;
        this.userService = userService;
    }

    @PostMapping(produces = MediaType.APPLICATION_OCTET_STREAM_VALUE)
    public void download(@Valid @RequestBody BackupRequest body, HttpServletResponse response) throws IOException {
        backupService.download(userService.getAuthenticatedUser(), body, new BackupSink() {
            @Override
            public void begin(String fileName, long contentLength) {
                response.setStatus(HttpServletResponse.SC_OK);
                response.setContentType(MediaType.APPLICATION_OCTET_STREAM_VALUE);
                response.setHeader("Cache-Control", "no-store");
                response.setHeader("Pragma", "no-cache");
                response.setHeader("X-Content-Type-Options", "nosniff");
                response.setHeader("Content-Disposition", "attachment; filename=\"" + fileName + "\"");
                response.setContentLengthLong(contentLength);
            }

            @Override
            public OutputStream body() throws IOException {
                return response.getOutputStream();
            }
        });
    }

    @GetMapping("/status")
    public Status status() {
        LocalDateTime last = downloadLog.lastFinished();
        Long days = last == null ? null : Duration.between(last, LocalDateTime.now(ZoneOffset.UTC)).toDays();
        List<Item> recent = downloadLog.recent().stream()
                .map(d -> new Item(d.getDownloadedAt(), d.getBytes(), d.isOk(), d.isAlertSent(), d.getAdminUserId()))
                .toList();
        return new Status(last, days, recent);
    }
}
