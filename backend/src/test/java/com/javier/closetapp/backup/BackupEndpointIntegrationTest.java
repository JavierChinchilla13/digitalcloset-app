package com.javier.closetapp.backup;

import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import com.javier.closetapp.legal.LegalVersion;
import com.javier.closetapp.support.FakeGoogleTokenVerifier;
import com.javier.closetapp.support.IntegrationTestBase;
import com.javier.closetapp.user.entity.User;
import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.mockito.Mockito;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.ResultActions;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.stream.Stream;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

// POST /api/admin/backup: who may call it, the proof, the limits, the one-at-a-time rule, the alert email, what is recorded, what is
// logged, and that the temporary file never outlives the request.
class BackupEndpointIntegrationTest extends IntegrationTestBase {

    private static final String ARCHIVE_PASSWORD = "an archive passphrase 123";
    private static final Path TEMP_DIR = Path.of("target/backup-test-tmp");

    @Autowired private BackupDownloadRepository downloads;
    @Autowired private BackupDownloadLog downloadLog;
    @Autowired private BackupConcurrencyGuard guard;
    @Autowired private BackupService backupService;
    @MockBean private BackupAlertMailer alertMailer;
    @Autowired private javax.sql.DataSource dataSourceForTests;
    @Autowired private com.javier.closetapp.auth.service.ReauthenticationService reauth;
    @Autowired private org.springframework.security.crypto.password.PasswordEncoder encoder;

    private ListAppender<ILoggingEvent> logs;
    private Logger root;

    @BeforeEach
    void captureLogs() {
        root = (Logger) LoggerFactory.getLogger(Logger.ROOT_LOGGER_NAME);
        logs = new ListAppender<>();
        logs.start();
        root.addAppender(logs);
    }

    @AfterEach
    void stopCapturing() {
        root.detachAppender(logs);
    }

    private TestUser admin() throws Exception {
        TestUser admin = registerUser();
        promoteToAdmin(admin);
        return admin;
    }

    private Map<String, Object> body(String currentPassword, String archivePassword) {
        Map<String, Object> body = new LinkedHashMap<>();
        if (currentPassword != null) body.put("currentPassword", currentPassword);
        if (archivePassword != null) body.put("archivePassword", archivePassword);
        return body;
    }

    private ResultActions backup(TestUser caller, Map<String, Object> body) throws Exception {
        return mockMvc.perform(post("/api/admin/backup").header("Authorization", caller.bearer())
                .contentType(MediaType.APPLICATION_JSON).content(json(body)));
    }

    private static long leftoverTempFiles() throws IOException {
        if (!Files.isDirectory(TEMP_DIR)) return 0;
        try (Stream<Path> s = Files.list(TEMP_DIR)) {
            return s.filter(p -> p.getFileName().toString().startsWith("vysvi-backup-")).count();
        }
    }

    // --- who may call it ---

    @Test
    @DisplayName("no token = 401; an ordinary user = 403; GET is not accepted")
    void permissions() throws Exception {
        TestUser ordinary = registerUser();
        mockMvc.perform(post("/api/admin/backup").contentType(MediaType.APPLICATION_JSON).content(json(body(PASSWORD, ARCHIVE_PASSWORD))))
                .andExpect(status().isUnauthorized());
        backup(ordinary, body(PASSWORD, ARCHIVE_PASSWORD)).andExpect(status().isForbidden());
        // The role is checked by the filter chain too (before the body is even read): a non-admin with a broken body still gets 403, not 400.
        mockMvc.perform(post("/api/admin/backup").header("Authorization", ordinary.bearer()).contentType(MediaType.APPLICATION_JSON).content("{ not json"))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/admin/backup").header("Authorization", admin().bearer())).andExpect(status().isMethodNotAllowed());
        mockMvc.perform(get("/api/admin/backup/status")).andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/admin/backup/status").header("Authorization", ordinary.bearer())).andExpect(status().isForbidden());
    }

    // --- the download ---

    @Test
    @DisplayName("an admin with the right password gets an encrypted archive that opens with the archive password, with the right headers")
    void happyPath(@TempDir Path work) throws Exception {
        TestUser admin = admin();
        createItem(admin, "admin-shirt", "TOP");

        MvcResult result = backup(admin, body(PASSWORD, ARCHIVE_PASSWORD))
                .andExpect(status().isOk())
                .andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(header().string("X-Content-Type-Options", "nosniff"))
                .andExpect(header().string("Content-Type", "application/octet-stream"))
                .andExpect(header().string("Content-Disposition", "attachment; filename=\"vysvi-backup-" + java.time.LocalDate.now(ZoneOffset.UTC) + ".vbk\""))
                .andReturn();
        byte[] bytes = result.getResponse().getContentAsByteArray();
        assertEquals(bytes.length, Integer.parseInt(result.getResponse().getHeader("Content-Length")));
        assertTrue(new String(bytes, 0, 8, java.nio.charset.StandardCharsets.US_ASCII).equals("VYSVIBK1"));

        Manifest manifest = ArchiveReader.extractAndVerify(new ByteArrayInputStream(bytes), ARCHIVE_PASSWORD.toCharArray(), work);
        assertEquals(BackupTables.INCLUDED.size(), manifest.tables().size());
        assertTrue(Files.readString(work.resolve("users.csv")).contains(admin.email()));
        // Nothing but the encrypted container is in the response: neither the user's email nor the garment name appears in clear.
        String raw = new String(bytes, java.nio.charset.StandardCharsets.ISO_8859_1);
        assertFalse(raw.contains(admin.email()));
        assertFalse(raw.contains("admin-shirt"));
        assertEquals(0, leftoverTempFiles());
        // The wrong archive password does not open it.
        Path other = work.resolve("other");
        assertThrows(ArchiveException.class, () -> ArchiveReader.extractAndVerify(new ByteArrayInputStream(bytes), "wrong wrong wrong".toCharArray(), other));
    }

    @Test
    @DisplayName("the download is recorded (id, bytes, ok, alert) and the status endpoint shows it, with no email or name anywhere")
    void downloadIsRecorded() throws Exception {
        TestUser admin = admin();
        backup(admin, body(PASSWORD, ARCHIVE_PASSWORD)).andExpect(status().isOk());

        BackupDownload row = downloads.findTop10ByOrderByIdDesc().get(0);
        assertEquals(admin.userId(), row.getAdminUserId());
        assertTrue(row.isOk());
        assertTrue(row.isAlertSent());
        assertTrue(row.getBytes() > 0);

        mockMvc.perform(get("/api/admin/backup/status").header("Authorization", admin.bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.daysSinceLastBackup").value(0))
                .andExpect(jsonPath("$.lastBackupAt").isNotEmpty())
                .andExpect(jsonPath("$.recent[0].ok").value(true))
                .andExpect(jsonPath("$.recent[0].alertSent").value(true))
                .andExpect(jsonPath("$.recent[0].email").doesNotExist());
        // The table holds only these columns.
        assertEquals(List.of("id", "downloadedAt", "adminUserId", "bytes", "ok", "alertSent"),
                java.util.Arrays.stream(BackupDownload.class.getDeclaredFields()).map(java.lang.reflect.Field::getName).toList());
    }

    @Test
    @DisplayName("status with no download yet says never (null), so the admin home can warn")
    void statusBeforeAnyBackup() throws Exception {
        downloads.deleteAll();
        mockMvc.perform(get("/api/admin/backup/status").header("Authorization", admin().bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.lastBackupAt").value((Object) null))
                .andExpect(jsonPath("$.daysSinceLastBackup").value((Object) null))
                .andExpect(jsonPath("$.recent").isEmpty());
    }

    // --- proof ---

    @Test
    @DisplayName("a wrong account password is 403 and counts toward the limit: the 4th attempt in the hour is 429, even with the right one")
    void wrongPasswordCounts() throws Exception {
        TestUser admin = admin();
        for (int i = 0; i < 3; i++) backup(admin, body("not-my-password", ARCHIVE_PASSWORD)).andExpect(status().isForbidden());
        backup(admin, body(PASSWORD, ARCHIVE_PASSWORD)).andExpect(status().isTooManyRequests());
        assertEquals(0, leftoverTempFiles());
        verify(alertMailer, Mockito.never()).sendBackupRequested(eq(admin.userId()), any(), any());
    }

    @Test
    @DisplayName("no proof at all is 403, and the 401 that logs people out is never used for a wrong proof")
    void missingProof() throws Exception {
        backup(admin(), body(null, ARCHIVE_PASSWORD)).andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("an archive password under 12 characters is 400 and does not count toward the limit")
    void shortArchivePassword() throws Exception {
        TestUser admin = admin();
        for (int i = 0; i < 5; i++) backup(admin, body(PASSWORD, "short")).andExpect(status().isBadRequest());
        backup(admin, body(PASSWORD, null)).andExpect(status().isBadRequest());
        backup(admin, body(PASSWORD, ARCHIVE_PASSWORD)).andExpect(status().isOk());
    }

    @Test
    @DisplayName("the archive password must differ from the account password")
    void archivePasswordMustDiffer() throws Exception {
        backup(admin(), body(PASSWORD, PASSWORD + PASSWORD)).andExpect(status().isOk());   // different: fine
        // PASSWORD is 15 characters, so it is long enough to be tried as the archive password:
        backup(admin(), body(PASSWORD, PASSWORD)).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("The archive password must be different from your account password."));
    }

    @Test
    @DisplayName("a Google-only admin proves it is them with a fresh Google credential for the same Google account")
    void googleOnlyAdmin() throws Exception {
        String sub = "sub-" + UUID.randomUUID();
        String email = uniqueEmail();
        Map<String, Object> signup = new LinkedHashMap<>();
        signup.put("credential", FakeGoogleTokenVerifier.credential(sub, email, true, "Ada", "Lovelace"));
        signup.put("birthYear", 1990);
        signup.put("birthMonth", 5);
        signup.put("guardianAuthorized", false);
        signup.put("termsAccepted", true);
        signup.put("dataAuthorized", true);
        signup.put("legalVersion", LegalVersion.CURRENT);
        String signedUp = mockMvc.perform(post("/api/auth/google/complete").contentType(MediaType.APPLICATION_JSON).content(json(signup)))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        TestUser google = new TestUser(((Number) JsonPath.read(signedUp, "$.userId")).longValue(), email, JsonPath.read(signedUp, "$.token"));
        promoteToAdmin(google);

        Map<String, Object> wrong = new LinkedHashMap<>();
        wrong.put("googleCredential", FakeGoogleTokenVerifier.credential("sub-someone-else", email, true, "A", "B"));
        wrong.put("archivePassword", ARCHIVE_PASSWORD);
        backup(google, wrong).andExpect(status().isForbidden());
        backup(google, body(PASSWORD, ARCHIVE_PASSWORD)).andExpect(status().isForbidden());   // a password means nothing to a Google-only admin

        Map<String, Object> right = new LinkedHashMap<>();
        right.put("googleCredential", FakeGoogleTokenVerifier.credential(sub, email, true, "Ada", "Lovelace"));
        right.put("archivePassword", ARCHIVE_PASSWORD);
        backup(google, right).andExpect(status().isOk());
    }

    // --- limits ---

    @Test
    @DisplayName("three finished downloads in the hour from the database stop the fourth (429), even after a restart cleared the memory counter")
    void databaseCountsFinishedDownloadsPerHour() throws Exception {
        TestUser admin = admin();
        for (int i = 0; i < 3; i++) downloadLog.record(admin.userId(), 1000, true, true);
        backup(admin, body(PASSWORD, ARCHIVE_PASSWORD)).andExpect(status().isTooManyRequests());
    }

    @Test
    @DisplayName("ten finished downloads in the day stop the eleventh (429)")
    void databaseCountsFinishedDownloadsPerDay() throws Exception {
        TestUser admin = admin();
        for (int i = 0; i < 10; i++) {
            downloads.save(new BackupDownload(LocalDateTime.now(ZoneOffset.UTC).minusHours(3), admin.userId(), 1000, true, true));
        }
        backup(admin, body(PASSWORD, ARCHIVE_PASSWORD)).andExpect(status().isTooManyRequests());
    }

    @Test
    @DisplayName("downloads that did not finish (ok=false) do not use up the download limit")
    void unfinishedDownloadsDoNotCount() throws Exception {
        TestUser admin = admin();
        for (int i = 0; i < 5; i++) downloadLog.record(admin.userId(), 0, false, true);
        backup(admin, body(PASSWORD, ARCHIVE_PASSWORD)).andExpect(status().isOk());
    }

    @Test
    @DisplayName("only one backup at a time, server-wide: a second is 429 while one is running, and fine afterwards")
    void oneAtATime() throws Exception {
        TestUser admin = admin();
        assertTrue(guard.tryEnter());
        try {
            backup(admin, body(PASSWORD, ARCHIVE_PASSWORD)).andExpect(status().isTooManyRequests());
        } finally {
            guard.leave();
        }
        backup(admin, body(PASSWORD, ARCHIVE_PASSWORD)).andExpect(status().isOk());
    }

    @Test
    @DisplayName("the one-at-a-time lock is released after a failure too")
    void lockReleasedAfterFailure() throws Exception {
        TestUser admin = admin();
        BackupSink failing = new BackupSink() {
            @Override public void begin(String fileName, long contentLength) { }
            @Override public OutputStream body() { return new OutputStream() {
                @Override public void write(int b) throws IOException { throw new IOException("client went away"); }
            }; }
        };
        backupService.download(userRepository.findByEmail(admin.email()).orElseThrow(), new BackupRequest(PASSWORD, null, ARCHIVE_PASSWORD), failing);
        assertTrue(guard.tryEnter());
        guard.leave();
    }

    // --- cleanup ---

    @Test
    @DisplayName("if the client hangs up part-way, the temp file is deleted, the lock released, and the row says ok = false")
    void abortCleansUp() throws Exception {
        TestUser admin = admin();
        AtomicInteger bytesWritten = new AtomicInteger();
        BackupSink hangsUp = new BackupSink() {
            @Override public void begin(String fileName, long contentLength) { }
            @Override public OutputStream body() { return new OutputStream() {
                @Override public void write(int b) throws IOException { throw new IOException("broken pipe"); }
                @Override public void write(byte[] b, int off, int len) throws IOException {
                    if (bytesWritten.addAndGet(len) > 100) throw new IOException("broken pipe");
                }
            }; }
        };
        User entity = userRepository.findByEmail(admin.email()).orElseThrow();
        backupService.download(entity, new BackupRequest(PASSWORD, null, ARCHIVE_PASSWORD), hangsUp);

        assertEquals(0, leftoverTempFiles());
        BackupDownload row = downloads.findTop10ByOrderByIdDesc().get(0);
        assertEquals(admin.userId(), row.getAdminUserId());
        assertFalse(row.isOk());
        assertEquals(0, row.getBytes());
        assertTrue(guard.tryEnter());
        guard.leave();
    }

    @Test
    @DisplayName("a download that takes longer than the deadline is cut off: temp file gone, lock released, row ok = false")
    void slowDownloadIsCutOff() throws Exception {
        TestUser admin = admin();
        long old = BackupService.streamDeadlineSeconds;
        BackupService.streamDeadlineSeconds = 0;
        try {
            BackupSink sink = new BackupSink() {
                @Override public void begin(String fileName, long contentLength) { }
                @Override public OutputStream body() { return new ByteArrayOutputStream(); }
            };
            backupService.download(userRepository.findByEmail(admin.email()).orElseThrow(), new BackupRequest(PASSWORD, null, ARCHIVE_PASSWORD), sink);
        } finally {
            BackupService.streamDeadlineSeconds = old;
        }
        assertEquals(0, leftoverTempFiles());
        assertFalse(downloads.findTop10ByOrderByIdDesc().get(0).isOk());
        assertTrue(guard.tryEnter());
        guard.leave();
    }

    @Test
    @DisplayName("a database failure while recording the download does not turn a finished download into an error")
    void recordFailureIsContained() throws Exception {
        TestUser admin = admin();
        BackupDownloadLog failing = new BackupDownloadLog(downloads) {
            @Override
            public void record(long adminUserId, long bytes, boolean ok, boolean alertSent) {
                throw new RuntimeException("db down");
            }
        };
        BackupService service = new BackupService(dataSourceForTests, reauth, encoder, new BackupAttemptLimiter(3, 10), guard, alertMailer, failing,
                "target/backup-test-tmp", 1000, 50_000_000L, 3, 10, true);
        ByteArrayOutputStream sunk = new ByteArrayOutputStream();
        BackupSink sink = new BackupSink() {
            @Override public void begin(String fileName, long contentLength) { }
            @Override public OutputStream body() { return sunk; }
        };
        service.download(userRepository.findByEmail(admin.email()).orElseThrow(), new BackupRequest(PASSWORD, null, ARCHIVE_PASSWORD), sink);
        assertTrue(sunk.size() > 0);
        assertTrue(guard.tryEnter());
        guard.leave();
    }

    @Test
    @DisplayName("stale temp files left by a crash are swept when the service starts")
    void staleTempFilesAreSwept() throws Exception {
        Files.createDirectories(TEMP_DIR);
        Path stale = Files.createFile(TEMP_DIR.resolve("vysvi-backup-stale-" + UUID.randomUUID() + ".vbk.part"));
        backupService.sweepStaleTempFiles();
        assertFalse(Files.exists(stale));
    }

    // --- the alert email ---

    @Test
    @DisplayName("the alert email goes out BEFORE the first byte of the archive")
    void alertComesFirst() throws Exception {
        TestUser admin = admin();
        AtomicInteger clock = new AtomicInteger();
        AtomicInteger mailedAt = new AtomicInteger(-1);
        AtomicInteger firstByteAt = new AtomicInteger(-1);
        doAnswer(inv -> { mailedAt.set(clock.incrementAndGet()); return null; }).when(alertMailer).sendBackupRequested(anyLong(), any(), any());
        ByteArrayOutputStream sunk = new ByteArrayOutputStream();
        BackupSink sink = new BackupSink() {
            @Override public void begin(String fileName, long contentLength) { firstByteAt.set(clock.incrementAndGet()); }
            @Override public OutputStream body() { return sunk; }
        };

        backupService.download(userRepository.findByEmail(admin.email()).orElseThrow(), new BackupRequest(PASSWORD, null, ARCHIVE_PASSWORD), sink);

        assertTrue(mailedAt.get() > 0 && mailedAt.get() < firstByteAt.get(), "the alert must be sent before the download begins");
        assertTrue(sunk.size() > 0);
        verify(alertMailer, times(1)).sendBackupRequested(eq(admin.userId()), eq(admin.email()), any());
    }

    @Test
    @DisplayName("if the alert email cannot be sent the download still happens, and the row says alert_sent = false (shown in the status list)")
    void alertFailureDoesNotStopTheDownload() throws Exception {
        TestUser admin = admin();
        doThrow(new RuntimeException("mail relay down for " + admin.email())).when(alertMailer).sendBackupRequested(anyLong(), any(), any());

        backup(admin, body(PASSWORD, ARCHIVE_PASSWORD)).andExpect(status().isOk());

        BackupDownload row = downloads.findTop10ByOrderByIdDesc().get(0);
        assertTrue(row.isOk());
        assertFalse(row.isAlertSent());
        mockMvc.perform(get("/api/admin/backup/status").header("Authorization", admin.bearer()))
                .andExpect(jsonPath("$.recent[0].alertSent").value(false))
                .andExpect(jsonPath("$.recent[0].ok").value(true));
        // The failure is logged without the exception's text (which named the address).
        assertTrue(messages().stream().anyMatch(m -> m.contains("alert email could not be sent for admin id " + admin.userId())));
        assertTrue(messages().stream().noneMatch(m -> m.contains(admin.email())));
    }

    // --- the log of downloads ---

    @Test
    @DisplayName("only the last 50 rows are kept")
    void keepsTheLast50() {
        for (int i = 0; i < 60; i++) downloadLog.record(1L, i, true, true);
        assertEquals(50, downloads.count());
        assertEquals(59, downloads.findTop10ByOrderByIdDesc().get(0).getBytes());
    }

    // --- logs ---

    private List<String> messages() {
        return logs.list.stream().map(e -> e.getFormattedMessage() + (e.getThrowableProxy() == null ? "" : " " + e.getThrowableProxy().getMessage())).toList();
    }

    @Test
    @DisplayName("nothing secret reaches the logs: no password, archive password, email or token, in success, wrong proof or failure")
    void noSecretsInLogs() throws Exception {
        TestUser admin = admin();
        TestUser other = registerUser();
        backup(admin, body(PASSWORD, ARCHIVE_PASSWORD)).andExpect(status().isOk());
        backup(admin, body("a-wrong-account-password", "another archive passphrase")).andExpect(status().isForbidden());
        backup(other, body(PASSWORD, ARCHIVE_PASSWORD)).andExpect(status().isForbidden());
        doThrow(new RuntimeException("smtp failed")).when(alertMailer).sendBackupRequested(anyLong(), any(), any());
        backup(admin, body(PASSWORD, "yet another archive pass")).andExpect(status().isOk());

        List<String> all = messages();
        assertFalse(all.isEmpty());
        for (String secret : new String[] {PASSWORD, ARCHIVE_PASSWORD, "a-wrong-account-password", "another archive passphrase",
                "yet another archive pass", admin.email(), other.email(), admin.token(), other.token()}) {
            for (String line : all) assertFalse(line.contains(secret), "a log line contains a secret: " + line);
        }
        // What IS logged: the admin id and sizes.
        assertTrue(all.stream().anyMatch(m -> m.contains("Backup downloaded by admin id " + admin.userId())));
    }

    // --- production floor ---

    @Test
    @DisplayName("the key derivation cannot be set below 600000 iterations (in any profile except the test one), nor above what the restore tool reads")
    void productionIterationFloor() {
        assertThrows(IllegalStateException.class, () -> new BackupService(null, null, null, null, null, null, null, "", 1000, 1000L, 3, 10, false));
        assertThrows(IllegalStateException.class, () -> new BackupService(null, null, null, null, null, null, null, "", BackupFormat.MAX_ITERATIONS + 1, 1000L, 3, 10, false));
        new BackupService(null, null, null, null, null, null, null, "", BackupCrypto.DEFAULT_ITERATIONS, 1000L, 3, 10, false);
        new BackupService(null, null, null, null, null, null, null, "", 1000, 1000L, 3, 10, true);     // only the test profile may do this
    }

    @Test
    @DisplayName("the shipped default is 600000 iterations")
    void shippedDefault() throws Exception {
        java.util.Properties p = new java.util.Properties();
        try (var in = Files.newInputStream(Path.of("src/main/resources/application.properties"))) {
            p.load(in);
        }
        assertTrue(p.getProperty("app.backup.pbkdf2-iterations").contains("600000"));
        assertEquals("209715200", p.getProperty("app.backup.max-bytes").replaceAll(".*:(\\d+)\\}", "$1"));
        assertNotNull(p.getProperty("app.backup.max-per-hour"));
    }
}
