package com.javier.closetapp.backup;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.DigestOutputStream;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.zip.GZIPInputStream;

// Opens a backup archive: decrypts it, unpacks the files into a directory, and checks every file against the manifest (size, SHA-256 and
// row count) and the manifest against the files. ANY problem (wrong password, a changed, reordered, cut-short or extended file, a file
// the manifest does not list, a bad name) throws ArchiveException and removes what was unpacked. The restore script uses this through
// ArchiveTool, so there is one implementation of the format.
public final class ArchiveReader {

    // Only the names the builder writes: <table>.csv and manifest.json. Anything else (such as ../x) is refused before a file is created.
    private static final java.util.regex.Pattern NAME = java.util.regex.Pattern.compile("[a-z_]+\\.csv|manifest\\.json");
    private static final long MAX_TOTAL_BYTES = 64L * 1024 * 1024 * 1024;

    private ArchiveReader() { }

    public static Manifest extractAndVerify(InputStream archive, char[] password, Path outDir) throws IOException {
        createPrivateDirectory(outDir);
        List<Path> created = new ArrayList<>();
        try {
            Manifest manifest = extract(archive, password, outDir, created);
            verify(manifest, outDir, created);
            return manifest;
        } catch (IOException | RuntimeException e) {
            for (Path p : created) Files.deleteIfExists(p);
            if (e instanceof ArchiveException) throw e;
            if (e instanceof IOException io) throw new ArchiveException("The backup file could not be read.", io);
            throw new ArchiveException("The backup file could not be read.", e);
        }
    }

    private static Manifest extract(InputStream archive, char[] password, Path outDir, List<Path> created) throws IOException {
        InputStream plain = BackupCrypto.decrypt(archive, password);
        GZIPInputStream gzip = new GZIPInputStream(plain);
        TarReader tar = new TarReader(gzip);
        Set<String> seen = new HashSet<>();
        long total = 0;
        boolean manifestSeen = false;
        for (TarReader.Entry entry = tar.next(); entry != null; entry = tar.next()) {
            if (!NAME.matcher(entry.name()).matches() || !seen.add(entry.name())) {
                throw new ArchiveException("The archive contains an unexpected file.");
            }
            if (manifestSeen) throw new ArchiveException("The archive has files after its manifest.");
            total += entry.size();
            if (total > MAX_TOTAL_BYTES) throw new ArchiveException("The archive is larger than expected.");
            Path target = outDir.resolve(entry.name());
            try (OutputStream out = newPrivateFile(target)) {
                created.add(target);
                tar.copyCurrentTo(out);
            }
            if (entry.name().equals("manifest.json")) manifestSeen = true;
        }
        if (!manifestSeen) throw new ArchiveException("The archive has no manifest.");
        // Read to the very end: gzip's own trailer, then the final encrypted chunk (its tag is what proves nothing was cut off).
        gzip.transferTo(OutputStream.nullOutputStream());
        plain.transferTo(OutputStream.nullOutputStream());
        plain.close();
        return Manifest.fromJson(Files.readString(outDir.resolve("manifest.json"), java.nio.charset.StandardCharsets.UTF_8));
    }

    // The unpacked files hold emails and password hashes: only the current user may read them (where the file system has permissions).
    private static void createPrivateDirectory(Path dir) throws IOException {
        if (Files.exists(dir)) return;
        try {
            Files.createDirectories(dir, java.nio.file.attribute.PosixFilePermissions.asFileAttribute(
                    java.nio.file.attribute.PosixFilePermissions.fromString("rwx------")));
        } catch (UnsupportedOperationException notPosix) {
            Files.createDirectories(dir);
        }
    }

    private static OutputStream newPrivateFile(Path target) throws IOException {
        try {
            Files.createFile(target, java.nio.file.attribute.PosixFilePermissions.asFileAttribute(
                    java.nio.file.attribute.PosixFilePermissions.fromString("rw-------")));
        } catch (UnsupportedOperationException notPosix) {
            Files.createFile(target);      // CREATE_NEW semantics: an existing file is refused
        }
        return Files.newOutputStream(target, java.nio.file.StandardOpenOption.WRITE, java.nio.file.StandardOpenOption.TRUNCATE_EXISTING);
    }

    private static void verify(Manifest manifest, Path outDir, List<Path> created) throws IOException {
        if (manifest == null || !Manifest.FORMAT.equals(manifest.format()) || manifest.formatVersion() != BackupFormat.FORMAT_VERSION
                || manifest.tables() == null) {
            throw new ArchiveException("The manifest is not valid.");
        }
        Set<String> listed = new HashSet<>();
        for (Manifest.TableEntry t : manifest.tables()) {
            if (t.file() == null || !NAME.matcher(t.file()).matches() || t.file().equals("manifest.json") || !listed.add(t.file())) {
                throw new ArchiveException("The manifest is not valid.");
            }
            Path file = outDir.resolve(t.file());
            if (!Files.isRegularFile(file)) throw new ArchiveException("A file the manifest lists is missing from the archive.");
            if (Files.size(file) != t.bytes()) throw new ArchiveException("A file does not match the manifest (size).");
            if (!sha256Of(file).equals(t.sha256())) throw new ArchiveException("A file does not match the manifest (checksum).");
            if (CsvRecords.countDataRecords(file) != t.rows()) throw new ArchiveException("A file does not match the manifest (row count).");
        }
        for (Path p : created) {
            String name = p.getFileName().toString();
            if (!name.equals("manifest.json") && !listed.contains(name)) {
                throw new ArchiveException("The archive has a file the manifest does not list.");
            }
        }
    }

    static String sha256Of(Path file) throws IOException {
        MessageDigest digest;
        try {
            digest = MessageDigest.getInstance("SHA-256");
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
        try (InputStream in = Files.newInputStream(file); OutputStream out = new DigestOutputStream(OutputStream.nullOutputStream(), digest)) {
            in.transferTo(out);
        }
        return HexFormat.of().formatHex(digest.digest());
    }
}
