package com.javier.closetapp.backup;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.javier.closetapp.exception.BackupTooLargeException;
import com.javier.closetapp.support.IntegrationTestBase;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.beans.factory.annotation.Autowired;

import javax.sql.DataSource;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.ResultSet;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Stream;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

// The archive itself, against the real (test) database: what goes in, what stays out, that it opens only with the right password, and
// that nothing is left on disk afterwards, whatever happens.
class ArchiveBuilderIntegrationTest extends IntegrationTestBase {

    private static final char[] ARCHIVE_PASSWORD = "an archive passphrase 123".toCharArray();

    @Autowired private DataSource dataSource;

    private static long count(Connection c, String table) throws Exception {
        try (var st = c.createStatement(); ResultSet rs = st.executeQuery("select count(*) from " + table)) {
            rs.next();
            return rs.getLong(1);
        }
    }

    private static List<String> files(Path dir) throws IOException {
        try (Stream<Path> s = Files.list(dir)) {
            return s.map(p -> p.getFileName().toString()).sorted().toList();
        }
    }

    @Test
    @DisplayName("every included table is in the archive with the right row count and checksum, and the excluded ones are not")
    void contentsMatchTheDatabase(@TempDir Path work) throws Exception {
        TestUser user = registerUser();
        createItem(user, "backup-shirt", "TOP");
        createItem(user, "backup-pants", "BOTTOM");

        ArchiveBuilder.Built built = ArchiveBuilder.build(dataSource, work.resolve("tmp"), ARCHIVE_PASSWORD, 1000, 50_000_000L);
        Path out = work.resolve("out");
        Manifest manifest;
        try (InputStream in = Files.newInputStream(built.file())) {
            manifest = ArchiveReader.extractAndVerify(in, ARCHIVE_PASSWORD, out);
        }

        assertEquals(BackupTables.INCLUDED, manifest.tables().stream().map(Manifest.TableEntry::name).toList());
        assertEquals(BackupTables.EXCLUDED, manifest.excludedTables());
        try (Connection c = dataSource.getConnection()) {
            for (Manifest.TableEntry t : manifest.tables()) {
                assertEquals(count(c, t.name()), t.rows(), t.name());
                assertEquals(t.sha256(), ArchiveReader.sha256Of(out.resolve(t.file())), t.name());
            }
        }
        Set<String> written = new HashSet<>(files(out));
        for (String excluded : BackupTables.EXCLUDED) assertFalse(written.contains(excluded + ".csv"), excluded + " must not be exported");
        assertTrue(written.contains("manifest.json"));
        assertEquals(BackupTables.INCLUDED.size() + 1, written.size());

        // The users file carries emails and password hashes: this is why the archive is a secret and always encrypted.
        String users = Files.readString(out.resolve("users.csv"));
        assertTrue(users.contains(user.email()));
        assertTrue(users.lines().findFirst().orElse("").contains("password"));
        assertTrue(Files.readString(out.resolve("clothing_items.csv")).contains("backup-shirt"));
        assertEquals(manifest.formatVersion(), 1);
        assertEquals(Manifest.FORMAT, new ObjectMapper().readTree(out.resolve("manifest.json").toFile()).get("format").asText());
    }

    @Test
    @DisplayName("the manifest itself holds no personal data (no emails, no names)")
    void manifestHoldsNoPersonalData(@TempDir Path work) throws Exception {
        TestUser user = registerUser();
        ArchiveBuilder.Built built = ArchiveBuilder.build(dataSource, work.resolve("tmp"), ARCHIVE_PASSWORD, 1000, 50_000_000L);
        Path out = work.resolve("out");
        try (InputStream in = Files.newInputStream(built.file())) {
            ArchiveReader.extractAndVerify(in, ARCHIVE_PASSWORD, out);
        }
        String manifest = Files.readString(out.resolve("manifest.json"));
        assertFalse(manifest.contains(user.email()));
        assertFalse(manifest.contains("@"));
    }

    @Test
    @DisplayName("the archive does not open with a wrong password, and nothing is left behind")
    void wrongPassword(@TempDir Path work) throws Exception {
        registerUser();
        ArchiveBuilder.Built built = ArchiveBuilder.build(dataSource, work.resolve("tmp"), ARCHIVE_PASSWORD, 1000, 50_000_000L);
        Path out = work.resolve("out");
        try (InputStream in = Files.newInputStream(built.file())) {
            assertThrows(ArchiveException.class, () -> ArchiveReader.extractAndVerify(in, "not the passphrase".toCharArray(), out));
        }
        assertEquals(List.of(), files(out));
    }

    @Test
    @DisplayName("a tampered archive (one flipped byte anywhere in several places) is rejected, and nothing is left unpacked")
    void tamperedArchive(@TempDir Path work) throws Exception {
        registerUser();
        ArchiveBuilder.Built built = ArchiveBuilder.build(dataSource, work.resolve("tmp"), ARCHIVE_PASSWORD, 1000, 50_000_000L);
        byte[] bytes = Files.readAllBytes(built.file());
        List<Integer> spots = new ArrayList<>(List.of(3, 20, BackupFormat.HEADER_LENGTH + 5, bytes.length / 2, bytes.length - 1));
        for (int spot : spots) {
            byte[] bad = bytes.clone();
            bad[spot] ^= 0x10;
            Path out = work.resolve("out-" + spot);
            assertThrows(ArchiveException.class, () -> ArchiveReader.extractAndVerify(new java.io.ByteArrayInputStream(bad), ARCHIVE_PASSWORD, out), "flip at " + spot);
            assertEquals(List.of(), files(out), "flip at " + spot);
        }
        byte[] cut = java.util.Arrays.copyOf(bytes, bytes.length - 40);
        Path out = work.resolve("out-cut");
        assertThrows(ArchiveException.class, () -> ArchiveReader.extractAndVerify(new java.io.ByteArrayInputStream(cut), ARCHIVE_PASSWORD, out));
    }

    @Test
    @DisplayName("over the cap the build stops with BackupTooLargeException and no temporary file is left")
    void capStopsTheBuild(@TempDir Path work) throws Exception {
        registerUser();
        Path tmp = work.resolve("tmp");
        assertThrows(BackupTooLargeException.class, () -> ArchiveBuilder.build(dataSource, tmp, ARCHIVE_PASSWORD, 1000, 300));
        assertEquals(List.of(), files(tmp));
    }

    @Test
    @DisplayName("the per-table temp file is capped too: a table whose plaintext is over the spool cap stops the build and leaves nothing")
    void spoolCap(@TempDir Path work) throws Exception {
        registerUser();
        Path tmp = work.resolve("tmp");
        BackupTooLargeException e = assertThrows(BackupTooLargeException.class,
                () -> ArchiveBuilder.build(dataSource, tmp, ARCHIVE_PASSWORD, 1000, 50_000_000L, 20));
        assertTrue(e.getMessage().contains("too large"));
        assertEquals(List.of(), files(tmp));
    }

    @Test
    @DisplayName("while the archive is being built, no table is ever on disk in clear: every temp file is encrypted")
    void spoolFilesAreNotPlaintext(@TempDir Path work) throws Exception {
        TestUser user = registerUser();
        Path tmp = work.resolve("tmp");
        java.util.concurrent.atomic.AtomicBoolean stop = new java.util.concurrent.atomic.AtomicBoolean();
        java.util.concurrent.atomic.AtomicBoolean leaked = new java.util.concurrent.atomic.AtomicBoolean();
        Thread watcher = new Thread(() -> {
            while (!stop.get()) {
                try (Stream<Path> s = Files.isDirectory(tmp) ? Files.list(tmp) : Stream.<Path>empty()) {
                    for (Path p : (Iterable<Path>) s::iterator) {
                        if (p.getFileName().toString().startsWith(ArchiveBuilder.SPOOL_PREFIX)) {
                            try {
                                String content = new String(Files.readAllBytes(p), java.nio.charset.StandardCharsets.ISO_8859_1);
                                if (content.contains(user.email()) || content.contains("user_id")) leaked.set(true);
                            } catch (IOException gone) {
                                // deleted between listing and reading: fine
                            }
                        }
                    }
                } catch (IOException ignored) {
                    // directory changing underneath: fine
                }
            }
        });
        watcher.start();
        try {
            for (int i = 0; i < 5; i++) ArchiveBuilder.build(dataSource, tmp, ARCHIVE_PASSWORD, 1000, 50_000_000L);
        } finally {
            stop.set(true);
            watcher.join();
        }
        assertFalse(leaked.get(), "a plaintext table was found on disk during the build");
    }

    @Test
    @DisplayName("a passphrase typed in a different Unicode form (accent as one character or as base + combining mark) opens the same archive")
    void passphraseIsNormalised(@TempDir Path work) throws Exception {
        registerUser();
        char[] composed = "caf\u00e9 passphrase 123".toCharArray();
        char[] decomposed = "cafe\u0301 passphrase 123".toCharArray();
        ArchiveBuilder.Built built = ArchiveBuilder.build(dataSource, work.resolve("tmp"), composed, 1000, 50_000_000L);
        try (InputStream in = Files.newInputStream(built.file())) {
            ArchiveReader.extractAndVerify(in, decomposed, work.resolve("out"));
        }
        assertTrue(Files.exists(work.resolve("out").resolve("manifest.json")));
    }

    @Test
    @DisplayName("unpacked files and the folder are private to the current user where the file system supports it")
    void unpackedFilesArePrivate(@TempDir Path work) throws Exception {
        org.junit.jupiter.api.Assumptions.assumeTrue(java.nio.file.FileSystems.getDefault().supportedFileAttributeViews().contains("posix"));
        registerUser();
        ArchiveBuilder.Built built = ArchiveBuilder.build(dataSource, work.resolve("tmp"), ARCHIVE_PASSWORD, 1000, 50_000_000L);
        Path out = work.resolve("out");
        try (InputStream in = Files.newInputStream(built.file())) {
            ArchiveReader.extractAndVerify(in, ARCHIVE_PASSWORD, out);
        }
        assertEquals("rwx------", java.nio.file.attribute.PosixFilePermissions.toString(Files.getPosixFilePermissions(out)));
        assertEquals("rw-------", java.nio.file.attribute.PosixFilePermissions.toString(Files.getPosixFilePermissions(out.resolve("users.csv"))));
    }

    private static byte[] encryptedTarWith(String[] names) throws IOException {
        java.io.ByteArrayOutputStream plain = new java.io.ByteArrayOutputStream();
        try (java.util.zip.GZIPOutputStream gz = new java.util.zip.GZIPOutputStream(plain); TarWriter tar = new TarWriter(gz)) {
            for (String name : names) tar.putFile(name, 1, new java.io.ByteArrayInputStream(new byte[1]), 0);
            tar.finish();
        }
        java.io.ByteArrayOutputStream encrypted = new java.io.ByteArrayOutputStream();
        try (java.io.OutputStream out = BackupCrypto.encrypt(encrypted, ARCHIVE_PASSWORD, 1000)) {
            out.write(plain.toByteArray());
        }
        return encrypted.toByteArray();
    }

    @Test
    @DisplayName("a hostile tar (a name like ../x, an unexpected file, a duplicate name) is refused and nothing is left unpacked")
    void hostileTarIsRefused(@TempDir Path work) throws Exception {
        String[][] cases = {{"..evil"}, {"users.csv.exe"}, {"other.txt"}, {"users.csv", "users.csv"}};
        int n = 0;
        for (String[] names : cases) {
            byte[] archive = encryptedTarWith(names);
            Path out = work.resolve("out-" + n++);
            assertThrows(ArchiveException.class,
                    () -> ArchiveReader.extractAndVerify(new java.io.ByteArrayInputStream(archive), ARCHIVE_PASSWORD, out), String.join(",", names));
            assertEquals(List.of(), files(out), String.join(",", names));
        }
    }

    @Test
    @DisplayName("a failure while building (a bad connection) leaves no temporary file")
    void failureLeavesNothing(@TempDir Path work) throws Exception {
        Path tmp = work.resolve("tmp");
        DataSource broken = new org.springframework.jdbc.datasource.AbstractDataSource() {
            @Override
            public Connection getConnection() throws java.sql.SQLException {
                throw new java.sql.SQLException("boom");
            }

            @Override
            public Connection getConnection(String u, String p) throws java.sql.SQLException {
                throw new java.sql.SQLException("boom");
            }
        };
        assertThrows(java.sql.SQLException.class, () -> ArchiveBuilder.build(broken, tmp, ARCHIVE_PASSWORD, 1000, 50_000_000L));
        assertEquals(List.of(), files(tmp));
    }

    // Runs the command-line tool the restore script uses, with the password on standard input.
    private static Object[] runTool(Path archive, Path out, String stdinLine) throws Exception {
        String javaBin = Path.of(System.getProperty("java.home"), "bin", "java").toString();
        Process p = new ProcessBuilder(javaBin, "-cp", Path.of("target/classes").toAbsolutePath().toString(),
                "com.javier.closetapp.backup.ArchiveTool", archive.toString(), out.toString()).redirectErrorStream(true).start();
        p.getOutputStream().write((stdinLine + "\n").getBytes(java.nio.charset.StandardCharsets.UTF_8));
        p.getOutputStream().close();
        String output = new String(p.getInputStream().readAllBytes(), java.nio.charset.StandardCharsets.UTF_8);
        assertTrue(p.waitFor(60, java.util.concurrent.TimeUnit.SECONDS));
        return new Object[] {p.exitValue(), output};
    }

    @Test
    @DisplayName("the command-line tool (used by the restore script) opens the archive with the password from standard input, and says nothing more than 'no' otherwise")
    void commandLineTool(@TempDir Path work) throws Exception {
        registerUser();
        ArchiveBuilder.Built built = ArchiveBuilder.build(dataSource, work.resolve("tmp"), ARCHIVE_PASSWORD, 1000, 50_000_000L);

        Path good = work.resolve("good");
        Object[] ok = runTool(built.file(), good, new String(ARCHIVE_PASSWORD));
        assertEquals(0, ok[0], (String) ok[1]);
        assertTrue(((String) ok[1]).contains("TABLE users "));
        assertFalse(((String) ok[1]).contains(new String(ARCHIVE_PASSWORD)));
        assertTrue(Files.exists(good.resolve("manifest.json")));

        Path bad = work.resolve("bad");
        Object[] wrong = runTool(built.file(), bad, "definitely the wrong one");
        assertEquals(2, wrong[0]);
        assertFalse(((String) wrong[1]).contains("definitely the wrong one"));
        assertEquals(List.of(), files(bad));
    }

    @Test
    @DisplayName("table guard: every table in the database is either exported or deliberately excluded")
    void everyTableIsDecidedOn() throws Exception {
        Set<String> known = new HashSet<>(BackupTables.INCLUDED);
        known.addAll(BackupTables.EXCLUDED);
        known.add(BackupTables.FLYWAY_TABLE);
        List<String> unknown = new ArrayList<>();
        try (Connection c = dataSource.getConnection(); ResultSet rs = c.getMetaData().getTables(null, c.getSchema(), "%", new String[] {"TABLE"})) {
            while (rs.next()) {
                String name = rs.getString("TABLE_NAME").toLowerCase();
                if (!known.contains(name)) unknown.add(name);
            }
        }
        assertEquals(List.of(), unknown, "A new table must be added to BackupTables.INCLUDED or EXCLUDED on purpose");
    }

    @Test
    @DisplayName("a JDBC-written CSV and its record counter agree on quotes, commas, empty strings, nulls and line breaks inside fields")
    void csvDumpIsFaithful(@TempDir Path work) throws Exception {
        TestUser user = registerUser();
        // A garment name with a comma, a quote and a line break, to exercise the quoting and the row counter.
        long id = createItem(user, "plain", "TOP");
        try (Connection c = dataSource.getConnection(); var st = c.prepareStatement("update clothing_items set name = ? where item_id = ?")) {
            st.setString(1, "sh,irt \"with\" quotes\nand a line break");
            st.setLong(2, id);
            st.executeUpdate();
        }
        ArchiveBuilder.Built built = ArchiveBuilder.build(dataSource, work.resolve("tmp"), ARCHIVE_PASSWORD, 1000, 50_000_000L);
        Path out = work.resolve("out");
        try (InputStream in = Files.newInputStream(built.file())) {
            Manifest manifest = ArchiveReader.extractAndVerify(in, ARCHIVE_PASSWORD, out);
            long dbRows;
            try (Connection c = dataSource.getConnection()) {
                dbRows = count(c, "clothing_items");
            }
            assertEquals(dbRows, manifest.tables().stream().filter(t -> t.name().equals("clothing_items")).findFirst().orElseThrow().rows());
        }
        assertTrue(Files.readString(out.resolve("clothing_items.csv")).contains("\"sh,irt \"\"with\"\" quotes\nand a line break\""));
    }
}
