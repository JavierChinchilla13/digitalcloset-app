package com.javier.closetapp.backup;

import com.javier.closetapp.auth.service.ReauthenticationService;
import com.javier.closetapp.exception.BackupTooLargeException;
import com.javier.closetapp.exception.InvalidInputException;
import com.javier.closetapp.exception.TooManyRequestsException;
import com.javier.closetapp.user.entity.User;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import javax.sql.DataSource;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.file.DirectoryStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.SQLException;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneOffset;

// The admin "Download backup": the order of the checks matters.
//
//   1. the archive password is long enough            -> 400 (nothing counted: it is only a bad form)
//   2. the attempt is counted (3/hour, 10/day)        -> 429
//   3. the admin proves who they are                  -> 403 (a wrong proof has already counted)
//   4. the archive password differs from theirs       -> 400
//   5. one backup at a time, server-wide              -> 429
//   6. finished downloads in the database (same limits, survive a restart; counted INSIDE the lock so two requests cannot both pass) -> 429
//   7. the alert email goes out (a failure is recorded as alert_sent = false and does NOT stop the download: the owner's decision)
//   8. the archive is built in a temp file (cap 200 MB -> 413), then streamed within a deadline, then the temp file is deleted, always
//
// The archive is never kept: it lives in a private temp file for the length of the request. Logs carry the admin's id and sizes only,
// never a password or an email address.
@Service
public class BackupService {

    private static final Logger log = LoggerFactory.getLogger(BackupService.class);

    static final int MIN_ARCHIVE_PASSWORD = 12;
    // A client that reads too slowly cannot hold the server-wide lock for longer than this once the archive is ready.
    static volatile long streamDeadlineSeconds = 600;     // not final only so a test can shorten it

    private final DataSource dataSource;
    private final ReauthenticationService reauthentication;
    private final PasswordEncoder passwordEncoder;
    private final BackupAttemptLimiter limiter;
    private final BackupConcurrencyGuard guard;
    private final BackupAlertMailer alertMailer;
    private final BackupDownloadLog downloadLog;
    private final Path tempDir;
    private final int iterations;
    private final long maxBytes;
    private final int perHour;
    private final int perDay;

    public BackupService(DataSource dataSource, ReauthenticationService reauthentication, PasswordEncoder passwordEncoder,
                         BackupAttemptLimiter limiter, BackupConcurrencyGuard guard, BackupAlertMailer alertMailer,
                         BackupDownloadLog downloadLog,
                         @Value("${app.backup.temp-dir:}") String tempDir,
                         @Value("${app.backup.pbkdf2-iterations:600000}") int iterations,
                         @Value("${app.backup.max-bytes:209715200}") long maxBytes,
                         @Value("${app.backup.max-per-hour:3}") int perHour,
                         @Value("${app.backup.max-per-day:10}") int perDay,
                         @Value("${app.backup.allow-weak-kdf-for-tests:false}") boolean allowWeakKdfForTests) {
        this.dataSource = dataSource;
        this.reauthentication = reauthentication;
        this.passwordEncoder = passwordEncoder;
        this.limiter = limiter;
        this.guard = guard;
        this.alertMailer = alertMailer;
        this.downloadLog = downloadLog;
        // A folder of our own (not the shared system temp), so cleaning up after a crash can never touch anything else.
        this.tempDir = tempDir == null || tempDir.isBlank() ? Path.of(System.getProperty("java.io.tmpdir"), "vysvi-backup") : Path.of(tempDir);
        this.iterations = iterations;
        this.maxBytes = maxBytes;
        this.perHour = perHour;
        this.perDay = perDay;
        // The key derivation is never weaker than the OWASP figure, in any profile; only the test profile may lower it.
        if (iterations > BackupFormat.MAX_ITERATIONS) {
            throw new IllegalStateException("app.backup.pbkdf2-iterations is above " + BackupFormat.MAX_ITERATIONS + ", which the restore tool refuses to read");
        }
        if (iterations < BackupCrypto.DEFAULT_ITERATIONS && !allowWeakKdfForTests) {
            throw new IllegalStateException("Refusing to start: app.backup.pbkdf2-iterations is below " + BackupCrypto.DEFAULT_ITERATIONS);
        }
    }

    // A crash can leave a half-built archive behind; nothing of that kind may survive a restart.
    @PostConstruct
    void sweepStaleTempFiles() {
        try {
            Files.createDirectories(tempDir);
            try (DirectoryStream<Path> stale = Files.newDirectoryStream(tempDir, ArchiveBuilder.ARCHIVE_PREFIX + "*")) {
                for (Path p : stale) Files.deleteIfExists(p);
            }
        } catch (IOException e) {
            log.warn("Could not clean old backup temp files ({})", e.getClass().getSimpleName());
        }
    }

    public void download(User admin, BackupRequest request, BackupSink sink) throws IOException {
        long adminId = admin.getUserId();
        String archivePassword = request.archivePassword();
        if (archivePassword == null || archivePassword.length() < MIN_ARCHIVE_PASSWORD) {
            throw new InvalidInputException("The archive password must be at least " + MIN_ARCHIVE_PASSWORD + " characters.");
        }
        limiter.acquire(adminId);
        reauthentication.requireProof(admin, request.currentPassword(), request.googleCredential());
        if (admin.getPassword() != null && passwordEncoder.matches(archivePassword, admin.getPassword())) {
            throw new InvalidInputException("The archive password must be different from your account password.");
        }
        if (!guard.tryEnter()) {
            throw new TooManyRequestsException("Another backup is being prepared. Please try again in a minute.");
        }
        // From here the lock is held and must be released on every path.
        try {
            LocalDateTime now = LocalDateTime.now(ZoneOffset.UTC);
            if (downloadLog.finishedSince(adminId, now.minusHours(1)) >= perHour || downloadLog.finishedSince(adminId, now.minusDays(1)) >= perDay) {
                throw new TooManyRequestsException("Too many backup downloads. Please try again later.");
            }
        } catch (RuntimeException e) {
            guard.leave();
            throw e;
        }

        char[] password = archivePassword.toCharArray();
        boolean alertSent = false;
        ArchiveBuilder.Built built = null;
        boolean ok = false;
        long bytes = 0;
        long started = System.currentTimeMillis();
        try {
            try {
                alertMailer.sendBackupRequested(adminId, admin.getEmail(), Instant.now());
                alertSent = true;
            } catch (RuntimeException e) {
                // Logged without the exception's message (it could name the address): only that it failed, and for whom (an id).
                log.warn("The backup alert email could not be sent for admin id {} ({})", adminId, e.getClass().getSimpleName());
            }

            try {
                built = ArchiveBuilder.build(dataSource, tempDir, password, iterations, maxBytes);
            } catch (BackupTooLargeException e) {
                log.warn("Backup for admin id {} refused: larger than the cap", adminId);
                throw e;
            } catch (IOException | SQLException e) {
                log.error("Backup for admin id {} failed while building ({})", adminId, e.getClass().getSimpleName());
                throw new IllegalStateException("The backup could not be prepared.");
            }

            bytes = built.bytes();
            sink.begin("vysvi-backup-" + LocalDate.now(ZoneOffset.UTC) + ".vbk", bytes);
            try {
                try (InputStream in = Files.newInputStream(built.file());
                     OutputStream out = new DeadlineOutputStream(sink.body(), System.nanoTime() + streamDeadlineSeconds * 1_000_000_000L)) {
                    in.transferTo(out);
                    out.flush();
                }
                ok = true;      // only after everything was written AND the stream closed cleanly
            } catch (IOException e) {
                // The admin's browser went away, was too slow, or the connection broke: nothing was kept, and it is recorded as not ok.
                log.info("Backup download for admin id {} was interrupted after preparing {} bytes", adminId, bytes);
            }
            if (ok) log.info("Backup downloaded by admin id {}: {} bytes in {} ms", adminId, bytes, System.currentTimeMillis() - started);
        } finally {
            java.util.Arrays.fill(password, '\0');
            if (built != null) deleteQuietly(built.file());
            try {
                downloadLog.record(adminId, ok ? bytes : 0, ok, alertSent);
            } catch (RuntimeException e) {
                // A database hiccup must not turn a finished download into an error over a response that is already sent.
                log.error("Could not record the backup download for admin id {} ({})", adminId, e.getClass().getSimpleName());
            } finally {
                guard.leave();
            }
        }
    }

    private static void deleteQuietly(Path file) {
        try {
            Files.deleteIfExists(file);
        } catch (IOException e) {
            log.warn("Could not delete a temporary backup file ({})", e.getClass().getSimpleName());
        }
    }

    // Stops a download that takes longer than the deadline (a client reading a trickle) so it cannot keep the server-wide lock.
    private static final class DeadlineOutputStream extends OutputStream {
        private final OutputStream out;
        private final long deadlineNanos;

        DeadlineOutputStream(OutputStream out, long deadlineNanos) {
            this.out = out;
            this.deadlineNanos = deadlineNanos;
        }

        private void check() throws IOException {
            if (System.nanoTime() - deadlineNanos > 0) throw new IOException("The download took too long");
        }

        @Override
        public void write(int b) throws IOException {
            check();
            out.write(b);
        }

        @Override
        public void write(byte[] b, int off, int len) throws IOException {
            check();
            out.write(b, off, len);
        }

        @Override
        public void flush() throws IOException {
            out.flush();
        }

        @Override
        public void close() throws IOException {
            out.close();
        }
    }
}
