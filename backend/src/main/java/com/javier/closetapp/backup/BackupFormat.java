package com.javier.closetapp.backup;

import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;

// The file format of a VYSVI backup (.vbk), version 1:
//
//   header (39 bytes, in clear, but authenticated: it is part of the "additional data" of every chunk below)
//     magic "VYSVIBK1" (8) | format version u16 | KDF id u8 | KDF iterations u32 | salt (16) | nonce prefix (4) | chunk size u32
//   chunk 0, chunk 1, ... each = AES-256-GCM(plaintext chunk) with its 16-byte tag appended
//     nonce = nonce prefix (4) || chunk counter (8, big endian); additional data = header || counter (8) || last-chunk flag (1)
//
// The plaintext is a gzip stream of a tar archive (one <table>.csv per table, then manifest.json). The key comes from the archive
// password with PBKDF2WithHmacSHA256 and the iteration count stored in the header, so the count can be raised later without a new
// format; KDF id 1 is that algorithm. Every chunk but the last holds exactly `chunk size` bytes of plaintext, so the reader needs no
// length fields, and the "last" flag in the additional data makes cutting the end off, or appending to it, fail authentication.
public final class BackupFormat {

    private BackupFormat() { }

    public static final byte[] MAGIC = "VYSVIBK1".getBytes(StandardCharsets.US_ASCII);
    public static final int FORMAT_VERSION = 1;
    public static final int KDF_PBKDF2_HMAC_SHA256 = 1;
    public static final int SALT_LENGTH = 16;
    public static final int NONCE_PREFIX_LENGTH = 4;
    public static final int TAG_LENGTH = 16;
    public static final int DEFAULT_CHUNK_SIZE = 64 * 1024;
    public static final int HEADER_LENGTH = 8 + 2 + 1 + 4 + SALT_LENGTH + NONCE_PREFIX_LENGTH + 4;

    // What a reader accepts (so a hostile file cannot make it spend minutes in the key derivation or allocate gigabytes).
    public static final int MAX_ITERATIONS = 10_000_000;
    public static final int MIN_CHUNK_SIZE = 1024;
    public static final int MAX_CHUNK_SIZE = 16 * 1024 * 1024;

    public record Header(int formatVersion, int kdfId, int iterations, byte[] salt, byte[] noncePrefix, int chunkSize) {

        public byte[] encode() {
            ByteBuffer b = ByteBuffer.allocate(HEADER_LENGTH);
            b.put(MAGIC);
            b.putShort((short) formatVersion);
            b.put((byte) kdfId);
            b.putInt(iterations);
            b.put(salt);
            b.put(noncePrefix);
            b.putInt(chunkSize);
            return b.array();
        }

        public static Header decode(byte[] bytes) throws ArchiveException {
            if (bytes.length != HEADER_LENGTH) throw new ArchiveException("This is not a VYSVI backup file.");
            ByteBuffer b = ByteBuffer.wrap(bytes);
            byte[] magic = new byte[MAGIC.length];
            b.get(magic);
            if (!Arrays.equals(magic, MAGIC)) throw new ArchiveException("This is not a VYSVI backup file.");
            int version = Short.toUnsignedInt(b.getShort());
            int kdf = Byte.toUnsignedInt(b.get());
            int iterations = b.getInt();
            byte[] salt = new byte[SALT_LENGTH];
            b.get(salt);
            byte[] prefix = new byte[NONCE_PREFIX_LENGTH];
            b.get(prefix);
            int chunk = b.getInt();
            if (version != FORMAT_VERSION) throw new ArchiveException("This backup file uses a format version this tool does not know.");
            if (kdf != KDF_PBKDF2_HMAC_SHA256) throw new ArchiveException("This backup file uses a key derivation this tool does not know.");
            if (iterations < 1 || iterations > MAX_ITERATIONS) throw new ArchiveException("The backup file header is not valid.");
            if (chunk < MIN_CHUNK_SIZE || chunk > MAX_CHUNK_SIZE) throw new ArchiveException("The backup file header is not valid.");
            return new Header(version, kdf, iterations, salt, prefix, chunk);
        }
    }
}
