package com.javier.closetapp.backup;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import javax.crypto.Cipher;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.HashSet;
import java.util.HexFormat;
import java.util.Random;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

// The encryption of the backup archive: the chunked AES-256-GCM and the PBKDF2 key. Small chunks (1 KiB) keep the multi-chunk cases quick.
class ChunkedAeadTest {

    private static final char[] PASSWORD = "correct horse battery staple".toCharArray();
    private static final int CHUNK = 1024;
    private static final int FRAME = CHUNK + BackupFormat.TAG_LENGTH;

    private static BackupFormat.Header header(int iterations) {
        byte[] salt = new byte[BackupFormat.SALT_LENGTH];
        byte[] prefix = new byte[BackupFormat.NONCE_PREFIX_LENGTH];
        new java.security.SecureRandom().nextBytes(salt);
        new java.security.SecureRandom().nextBytes(prefix);
        return new BackupFormat.Header(BackupFormat.FORMAT_VERSION, BackupFormat.KDF_PBKDF2_HMAC_SHA256, iterations, salt, prefix, CHUNK);
    }

    private static byte[] encrypt(byte[] plain, BackupFormat.Header header) throws IOException {
        ByteArrayOutputStream sink = new ByteArrayOutputStream();
        try (OutputStream out = BackupCrypto.encrypt(sink, PASSWORD, header)) {
            out.write(plain);
        }
        return sink.toByteArray();
    }

    private static byte[] encrypt(byte[] plain) throws IOException {
        return encrypt(plain, header(1000));
    }

    private static byte[] decrypt(byte[] archive, char[] password) throws IOException {
        try (InputStream in = BackupCrypto.decrypt(new ByteArrayInputStream(archive), password)) {
            return in.readAllBytes();
        }
    }

    private static byte[] random(int n) {
        byte[] b = new byte[n];
        new Random(42).nextBytes(b);
        return b;
    }

    // --- round trip ---

    @Test
    @DisplayName("round trip at the sizes around a chunk boundary, including empty")
    void roundTrip() throws IOException {
        for (int n : new int[] {0, 1, CHUNK - 1, CHUNK, CHUNK + 1, 2 * CHUNK, 3 * CHUNK + 17, 10 * CHUNK}) {
            byte[] plain = random(n);
            assertArrayEquals(plain, decrypt(encrypt(plain), PASSWORD), "size " + n);
        }
    }

    @Test
    @DisplayName("the archive size is the header plus whole frames (no padding, no length fields)")
    void sizeIsPredictable() throws IOException {
        assertEquals(BackupFormat.HEADER_LENGTH + BackupFormat.TAG_LENGTH, encrypt(new byte[0]).length);
        assertEquals(BackupFormat.HEADER_LENGTH + FRAME, encrypt(random(CHUNK)).length);
        assertEquals(BackupFormat.HEADER_LENGTH + FRAME + BackupFormat.TAG_LENGTH + 1, encrypt(random(CHUNK + 1)).length);
    }

    @Test
    @DisplayName("a wrong password is refused, with the same generic message as a damaged file")
    void wrongPassword() throws IOException {
        byte[] archive = encrypt(random(3000));
        ArchiveException wrong = assertThrows(ArchiveException.class, () -> decrypt(archive, "another password!".toCharArray()));
        byte[] flipped = archive.clone();
        flipped[flipped.length - 1] ^= 1;
        ArchiveException damaged = assertThrows(ArchiveException.class, () -> decrypt(flipped, PASSWORD));
        assertEquals(wrong.getMessage(), damaged.getMessage());
        assertFalse(wrong.getMessage().contains("another password"));
    }

    @Test
    @DisplayName("the same data under the same password encrypts differently each time (random salt and nonce prefix)")
    void freshRandomnessEveryTime() throws IOException {
        byte[] plain = random(2000);
        byte[] a = BackupCrypto_encryptDefaultHeader(plain);
        byte[] b = BackupCrypto_encryptDefaultHeader(plain);
        assertFalse(Arrays.equals(a, b));
        assertNotEquals(HexFormat.of().formatHex(a, 0, BackupFormat.HEADER_LENGTH), HexFormat.of().formatHex(b, 0, BackupFormat.HEADER_LENGTH));
    }

    private static byte[] BackupCrypto_encryptDefaultHeader(byte[] plain) throws IOException {
        ByteArrayOutputStream sink = new ByteArrayOutputStream();
        try (OutputStream out = BackupCrypto.encrypt(sink, PASSWORD, 1000)) {
            out.write(plain);
        }
        return sink.toByteArray();
    }

    // --- nonce uniqueness ---

    @Test
    @DisplayName("nonces never repeat: unique per chunk counter, and different for different files")
    void nonceUniqueness() {
        byte[] prefix = {1, 2, 3, 4};
        Set<String> seen = new HashSet<>();
        for (long i = 0; i < 100_000; i++) {
            assertTrue(seen.add(HexFormat.of().formatHex(ChunkedAead.nonce(prefix, i))), "nonce repeated at chunk " + i);
        }
        assertEquals(12, ChunkedAead.nonce(prefix, 0).length);
        // A different file has a different random prefix, so even chunk 0 differs (collision odds 2^-32 per pair; fixed here).
        assertNotEquals(HexFormat.of().formatHex(ChunkedAead.nonce(prefix, 0)), HexFormat.of().formatHex(ChunkedAead.nonce(new byte[] {1, 2, 3, 5}, 0)));
        // And the prefixes really are random per file.
        Set<String> prefixes = new HashSet<>();
        for (int i = 0; i < 50; i++) {
            prefixes.add(HexFormat.of().formatHex(header(1000).noncePrefix()));
        }
        assertTrue(prefixes.size() > 45);
    }

    // --- known answers ---

    @Test
    @DisplayName("known answer: the JDK's AES-256-GCM matches the published test cases 13 and 14 of the GCM specification")
    void gcmSpecificationVectors() throws Exception {
        SecretKey zeroKey = new SecretKeySpec(new byte[32], "AES");
        Cipher empty = Cipher.getInstance("AES/GCM/NoPadding");
        empty.init(Cipher.ENCRYPT_MODE, zeroKey, new GCMParameterSpec(128, new byte[12]));
        assertEquals("530f8afbc74536b9a963b4f1c4cb738b", HexFormat.of().formatHex(empty.doFinal(new byte[0])));

        Cipher sixteen = Cipher.getInstance("AES/GCM/NoPadding");
        sixteen.init(Cipher.ENCRYPT_MODE, zeroKey, new GCMParameterSpec(128, new byte[12]));
        assertEquals("cea7403d4d606b6e074ec5d3baf39d18" + "d0d1c8a799996bf0265b98b5d48ab919", HexFormat.of().formatHex(sixteen.doFinal(new byte[16])));
    }

    @Test
    @DisplayName("known answer: PBKDF2-HMAC-SHA256 of 'passwd'/'salt' with 1 iteration (RFC 7914 section 11)")
    void pbkdf2Vector() throws IOException {
        SecretKey key = BackupCrypto.deriveKey("passwd".toCharArray(), "salt".getBytes(), 1);
        assertEquals("55ac046e56e3089fec1691c22544b605f94185216dde0465e68b9d57c20dacbc", HexFormat.of().formatHex(key.getEncoded()));
    }

    @Test
    @DisplayName("known answer: fixed key, header and data give exactly the frames built independently with the raw JDK cipher")
    void framingKnownAnswer() throws Exception {
        SecretKey key = new SecretKeySpec(HexFormat.of().parseHex("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f"), "AES");
        byte[] prefix = HexFormat.of().parseHex("a1a2a3a4");
        BackupFormat.Header header = new BackupFormat.Header(1, 1, 1000, HexFormat.of().parseHex("00112233445566778899aabbccddeeff"), prefix, CHUNK);
        byte[] headerBytes = header.encode();
        byte[] plain = new byte[CHUNK + 476];
        for (int i = 0; i < plain.length; i++) plain[i] = (byte) (i * 31 + 7);

        ByteArrayOutputStream sink = new ByteArrayOutputStream();
        try (OutputStream out = ChunkedAead.encryptor(sink, key, headerBytes, prefix, CHUNK)) {
            out.write(plain);
        }

        // Independent construction: nonce = prefix || 8-byte counter, AAD = header || counter || last flag.
        ByteArrayOutputStream expected = new ByteArrayOutputStream();
        for (int chunk = 0; chunk < 2; chunk++) {
            byte[] nonce = new byte[12];
            System.arraycopy(prefix, 0, nonce, 0, 4);
            nonce[11] = (byte) chunk;
            byte[] aad = Arrays.copyOf(headerBytes, headerBytes.length + 9);
            aad[headerBytes.length + 7] = (byte) chunk;
            aad[headerBytes.length + 8] = (byte) (chunk == 1 ? 1 : 0);
            Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
            c.init(Cipher.ENCRYPT_MODE, key, new GCMParameterSpec(128, nonce));
            c.updateAAD(aad);
            expected.write(c.doFinal(plain, chunk * CHUNK, chunk == 0 ? CHUNK : 476));
        }
        assertArrayEquals(expected.toByteArray(), sink.toByteArray());
        // Frozen output of the fixed input: a change to the format must be a deliberate decision.
        assertEquals(FROZEN_DIGEST, HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(sink.toByteArray())));
    }

    private static final String FROZEN_DIGEST = "993c901b1a91df20dc3881a1b5302c590fe1b225f67b34012664ee7cce8b67b3";

    // --- tampering ---

    private byte[] sample() throws IOException {
        return encrypt(random(5 * CHUNK + 100));    // header + 5 full frames + 1 short frame
    }

    @Test
    @DisplayName("flipping any single bit anywhere (header, data, tag, last chunk) is detected")
    void bitFlipsAreDetected() throws IOException {
        byte[] archive = sample();
        int[] positions = {0, 5, 9, 12, 20, 30, BackupFormat.HEADER_LENGTH - 1,   // header fields
                BackupFormat.HEADER_LENGTH, BackupFormat.HEADER_LENGTH + 500,       // first chunk data
                BackupFormat.HEADER_LENGTH + CHUNK + 3,                              // first chunk tag
                BackupFormat.HEADER_LENGTH + 3 * FRAME + 10,                         // a middle chunk
                archive.length - BackupFormat.TAG_LENGTH - 20,                       // last chunk data
                archive.length - 1};                                                 // last tag byte
        for (int pos : positions) {
            byte[] bad = archive.clone();
            bad[pos] ^= 0x01;
            assertThrows(ArchiveException.class, () -> decrypt(bad, PASSWORD), "flip at " + pos);
        }
    }

    @Test
    @DisplayName("swapping two chunks is detected")
    void reorderingIsDetected() throws IOException {
        byte[] archive = sample();
        byte[] bad = archive.clone();
        int h = BackupFormat.HEADER_LENGTH;
        System.arraycopy(archive, h + FRAME, bad, h, FRAME);          // chunk 1 where chunk 0 was
        System.arraycopy(archive, h, bad, h + FRAME, FRAME);          // chunk 0 where chunk 1 was
        assertThrows(ArchiveException.class, () -> decrypt(bad, PASSWORD));
    }

    @Test
    @DisplayName("dropping a chunk from the middle is detected")
    void droppedChunkIsDetected() throws IOException {
        byte[] archive = sample();
        int h = BackupFormat.HEADER_LENGTH;
        byte[] bad = new byte[archive.length - FRAME];
        System.arraycopy(archive, 0, bad, 0, h + 2 * FRAME);
        System.arraycopy(archive, h + 3 * FRAME, bad, h + 2 * FRAME, archive.length - h - 3 * FRAME);
        assertThrows(ArchiveException.class, () -> decrypt(bad, PASSWORD));
    }

    @Test
    @DisplayName("truncating (at a chunk boundary, inside a chunk, by one byte, or to nothing after the header) is detected")
    void truncationIsDetected() throws IOException {
        byte[] archive = sample();
        int h = BackupFormat.HEADER_LENGTH;
        for (int length : new int[] {h, h + 5, h + FRAME, h + FRAME + 7, h + 3 * FRAME, h + 5 * FRAME, archive.length - 1, archive.length - 17}) {
            byte[] cut = Arrays.copyOf(archive, length);
            assertThrows(ArchiveException.class, () -> decrypt(cut, PASSWORD), "cut to " + length);
        }
        assertThrows(ArchiveException.class, () -> decrypt(Arrays.copyOf(archive, 10), PASSWORD));
        assertThrows(ArchiveException.class, () -> decrypt(new byte[0], PASSWORD));
    }

    @Test
    @DisplayName("appending anything (a byte, or a copy of a whole chunk) is detected")
    void appendingIsDetected() throws IOException {
        byte[] archive = sample();
        byte[] plusByte = Arrays.copyOf(archive, archive.length + 1);
        assertThrows(ArchiveException.class, () -> decrypt(plusByte, PASSWORD));
        byte[] plusFrame = new byte[archive.length + FRAME];
        System.arraycopy(archive, 0, plusFrame, 0, archive.length);
        System.arraycopy(archive, BackupFormat.HEADER_LENGTH, plusFrame, archive.length, FRAME);
        assertThrows(ArchiveException.class, () -> decrypt(plusFrame, PASSWORD));
    }

    @Test
    @DisplayName("a header that is not a VYSVI backup, or has absurd values, is refused before any key derivation")
    void headerIsValidated() throws IOException {
        byte[] archive = sample();
        byte[] notOurs = archive.clone();
        notOurs[0] = 'X';
        assertThrows(ArchiveException.class, () -> decrypt(notOurs, PASSWORD));
        byte[] hugeIterations = archive.clone();
        hugeIterations[11] = 0x7f;     // iterations u32 starts at offset 11
        assertThrows(ArchiveException.class, () -> decrypt(hugeIterations, PASSWORD));
    }

    @Test
    @DisplayName("the default key derivation is PBKDF2-HMAC-SHA256 with 600000 iterations, and the header carries the count")
    void defaultsAndHeader() throws IOException {
        assertEquals(600_000, BackupCrypto.DEFAULT_ITERATIONS);
        byte[] archive = encrypt(random(10), header(2345));
        BackupFormat.Header read = BackupFormat.Header.decode(Arrays.copyOf(archive, BackupFormat.HEADER_LENGTH));
        assertEquals(2345, read.iterations());
        assertEquals(BackupFormat.KDF_PBKDF2_HMAC_SHA256, read.kdfId());
    }
}
