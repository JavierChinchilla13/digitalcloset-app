package com.javier.closetapp.backup;

import com.javier.closetapp.exception.BackupTooLargeException;

import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;
import javax.sql.DataSource;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.attribute.PosixFilePermissions;
import java.security.DigestOutputStream;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;
import java.util.zip.GZIPOutputStream;

// Builds the encrypted backup archive into a TEMPORARY FILE (the caller deletes it, always) and returns where it is.
//
//   database --(COPY or ResultSet, one table at a time)--> small ENCRYPTED temp file per table (row count + SHA-256 on the way)
//            --> tar --> gzip --> AES-256-GCM chunks --> the archive file (counted: over the cap it is stopped and deleted)
//
// Memory does not depend on the database: every stage moves small pieces. All tables are read inside ONE read-only repeatable-read
// transaction on PostgreSQL, so the archive is a consistent snapshot even while people use the site, and with a statement timeout so
// it cannot hold the snapshot forever. The per-table temp file is encrypted with a throwaway random key kept only in memory, so no
// plaintext copy of the database (emails, password hashes) is ever on disk, and its size is capped too.
final class ArchiveBuilder {

    record Built(Path file, long bytes, Manifest manifest) { }

    static final String SPOOL_PREFIX = "vysvi-backup-spool-";
    static final String ARCHIVE_PREFIX = "vysvi-backup-";

    // How long one statement (one table's COPY) may run on PostgreSQL.
    private static final String STATEMENT_TIMEOUT = "120s";
    // The plaintext of ONE table may be at most this many times the cap of the final archive (it compresses well, so more than 1x).
    private static final long SPOOL_CAP_FACTOR = 20;

    private static final SecureRandom RANDOM = new SecureRandom();

    private ArchiveBuilder() { }

    static Built build(DataSource dataSource, Path tempDir, char[] password, int iterations, long maxBytes) throws IOException, SQLException {
        return build(dataSource, tempDir, password, iterations, maxBytes, maxBytes * SPOOL_CAP_FACTOR);
    }

    // With an explicit cap on the plaintext of one table (tests use a tiny one).
    static Built build(DataSource dataSource, Path tempDir, char[] password, int iterations, long maxBytes, long spoolCap) throws IOException, SQLException {
        Files.createDirectories(tempDir);
        Path archive = createPrivateTempFile(tempDir, ARCHIVE_PREFIX, ".vbk.part");
        boolean done = false;
        try (Connection connection = dataSource.getConnection()) {
            boolean oldAutoCommit = connection.getAutoCommit();
            connection.setAutoCommit(false);
            try {
                TableDumper dumper = TableDumper.forConnection(connection);
                if (dumper instanceof PostgresCopyDumper) {
                    try (Statement st = connection.createStatement()) {
                        st.execute("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY");
                        st.execute("SET LOCAL statement_timeout = '" + STATEMENT_TIMEOUT + "'");
                    }
                }
                String schemaVersion = schemaVersion(connection);

                Manifest[] result = new Manifest[1];
                // The raw file stream is closed here whatever happens below (a failure inside the encrypting wrappers would not close it).
                try (OutputStream file = new CappedOutputStream(Files.newOutputStream(archive), maxBytes,
                        "The backup is larger than the " + (maxBytes / (1024 * 1024)) + " MB limit of the in-app download.")) {
                    try (TarWriter tar = new TarWriter(new GZIPOutputStream(BackupCrypto.encrypt(file, password, iterations), 64 * 1024))) {
                        long now = Instant.now().getEpochSecond();
                        List<Manifest.TableEntry> entries = new ArrayList<>();
                        for (String table : BackupTables.INCLUDED) {
                            entries.add(addTable(connection, dumper, tar, tempDir, table, now, spoolCap));
                        }
                        Manifest manifest = new Manifest(Manifest.FORMAT, BackupFormat.FORMAT_VERSION, Instant.ofEpochSecond(now).toString(),
                                schemaVersion, entries, BackupTables.EXCLUDED);
                        byte[] json = manifest.toJson().getBytes(StandardCharsets.UTF_8);
                        tar.putFile("manifest.json", json.length, new ByteArrayInputStream(json), now);
                        tar.finish();
                        connection.rollback();      // read-only: nothing to commit
                        // The archive is finished only when the encrypting stream closes (its last chunk), which happens as `tar` closes.
                        result[0] = manifest;
                    }
                }
                long bytes = Files.size(archive);
                done = true;
                return new Built(archive, bytes, result[0]);
            } finally {
                try {
                    connection.setAutoCommit(oldAutoCommit);
                } catch (SQLException ignored) {
                    // the connection is closed right after
                }
            }
        } finally {
            if (!done) Files.deleteIfExists(archive);
        }
    }

    // Dumps one table to an ENCRYPTED temp file (learning its rows and SHA-256), copies it into the tar, and deletes the temp file at once.
    private static Manifest.TableEntry addTable(Connection connection, TableDumper dumper, TarWriter tar, Path tempDir, String table, long now,
                                                 long spoolCap) throws IOException, SQLException {
        Path spool = createPrivateTempFile(tempDir, SPOOL_PREFIX, ".enc");
        try {
            // A fresh random key and header for this one temp file; they exist only in this method.
            byte[] keyBytes = new byte[32];
            byte[] header = new byte[BackupFormat.HEADER_LENGTH];
            byte[] prefix = new byte[BackupFormat.NONCE_PREFIX_LENGTH];
            RANDOM.nextBytes(keyBytes);
            RANDOM.nextBytes(header);
            RANDOM.nextBytes(prefix);
            SecretKey key = new SecretKeySpec(keyBytes, "AES");

            MessageDigest digest = sha256();
            TableDumper.Dumped dumped;
            CappedOutputStream counted;
            try (OutputStream raw = new DigestOutputStream(
                    ChunkedAead.encryptor(Files.newOutputStream(spool), key, header, prefix, BackupFormat.DEFAULT_CHUNK_SIZE), digest)) {
                counted = new CappedOutputStream(raw, spoolCap, "The database is too large for the in-app backup.");
                dumped = dumper.dump(connection, table, counted);
                counted.flush();
            }
            long size = counted.written();
            try (InputStream in = ChunkedAead.decryptor(Files.newInputStream(spool), key, header, prefix, BackupFormat.DEFAULT_CHUNK_SIZE)) {
                tar.putFile(table + ".csv", size, in, now);
            }
            java.util.Arrays.fill(keyBytes, (byte) 0);
            return new Manifest.TableEntry(table, table + ".csv", dumped.rows(), size, HexFormat.of().formatHex(digest.digest()), dumped.columns());
        } finally {
            Files.deleteIfExists(spool);
        }
    }

    // The newest Flyway migration that was applied, or "unknown" when there is no Flyway history (the test suite builds its schema
    // from the entities).
    private static String schemaVersion(Connection connection) throws SQLException {
        boolean present;
        try (ResultSet tables = connection.getMetaData().getTables(null, null, BackupTables.FLYWAY_TABLE, null)) {
            present = tables.next();
        }
        if (!present) return "unknown";
        try (Statement st = connection.createStatement();
             ResultSet rs = st.executeQuery("select version from " + BackupTables.FLYWAY_TABLE
                     + " where success = true and version is not null order by installed_rank desc limit 1")) {
            return rs.next() ? rs.getString(1) : "unknown";
        }
    }

    // A file only the server's user can read where the file system supports permissions.
    static Path createPrivateTempFile(Path dir, String prefix, String suffix) throws IOException {
        try {
            return Files.createTempFile(dir, prefix, suffix, PosixFilePermissions.asFileAttribute(PosixFilePermissions.fromString("rw-------")));
        } catch (UnsupportedOperationException notPosix) {
            return Files.createTempFile(dir, prefix, suffix);
        }
    }

    private static MessageDigest sha256() {
        try {
            return MessageDigest.getInstance("SHA-256");
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    // Counts what passes and stops the build, with BackupTooLargeException, when it goes past `max`.
    private static final class CappedOutputStream extends OutputStream {
        private final OutputStream out;
        private final long max;
        private final String message;
        private long written = 0;

        CappedOutputStream(OutputStream out, long max, String message) {
            this.out = out;
            this.max = max;
            this.message = message;
        }

        long written() {
            return written;
        }

        @Override
        public void write(int b) throws IOException {
            count(1);
            out.write(b);
        }

        @Override
        public void write(byte[] b, int off, int len) throws IOException {
            count(len);
            out.write(b, off, len);
        }

        private void count(long n) {
            written += n;
            if (written > max) throw new BackupTooLargeException(message);
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
