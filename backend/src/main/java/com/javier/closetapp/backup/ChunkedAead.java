package com.javier.closetapp.backup;

import javax.crypto.AEADBadTagException;
import javax.crypto.Cipher;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.ByteBuffer;
import java.security.GeneralSecurityException;
import java.util.Arrays;

// AES-256-GCM over a stream, in chunks, so memory stays at one chunk however large the archive is (the JDK's GCM decryption holds the
// whole message in memory until the tag is checked, which would make memory grow with the database).
//
// Per chunk: nonce = nonce prefix (4 random bytes, new for every file) || chunk counter (8 bytes), so a nonce is never used twice
// under one key; additional data = the whole file header || chunk counter || 1 if this is the last chunk, else 0. Authenticating the
// header, the position and the "last" flag means a flipped bit anywhere, two chunks swapped, a chunk dropped from the middle, the end
// cut off, or something appended all fail with an ArchiveException.
final class ChunkedAead {

    private static final int GCM_TAG_BITS = BackupFormat.TAG_LENGTH * 8;

    private ChunkedAead() { }

    // The 12-byte nonce of chunk `counter`.
    static byte[] nonce(byte[] prefix, long counter) {
        return ByteBuffer.allocate(12).put(prefix).putLong(counter).array();
    }

    // The additional data of chunk `counter`.
    static byte[] aad(byte[] headerBytes, long counter, boolean last) {
        return ByteBuffer.allocate(headerBytes.length + 9).put(headerBytes).putLong(counter).put((byte) (last ? 1 : 0)).array();
    }

    private static byte[] seal(SecretKey key, byte[] headerBytes, byte[] prefix, long counter, boolean last, byte[] plain, int length)
            throws IOException {
        try {
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, key, new GCMParameterSpec(GCM_TAG_BITS, nonce(prefix, counter)));
            cipher.updateAAD(aad(headerBytes, counter, last));
            return cipher.doFinal(plain, 0, length);
        } catch (GeneralSecurityException e) {
            throw new IOException("Encryption failed", e);
        }
    }

    // Writes `chunk size` bytes of plaintext per chunk to `out`. The header is NOT written here (the caller does that first).
    static OutputStream encryptor(OutputStream out, SecretKey key, byte[] headerBytes, byte[] noncePrefix, int chunkSize) {
        return new OutputStream() {
            private final byte[] buffer = new byte[chunkSize];
            private int filled = 0;
            private long counter = 0;
            private boolean closed = false;

            @Override
            public void write(int b) throws IOException {
                write(new byte[] {(byte) b}, 0, 1);
            }

            @Override
            public void write(byte[] data, int off, int len) throws IOException {
                if (closed) throw new IOException("Stream closed");
                while (len > 0) {
                    // A full buffer is written out only when more data arrives, so the final chunk is always the one flushed by close().
                    if (filled == chunkSize) emit(false);
                    int n = Math.min(len, chunkSize - filled);
                    System.arraycopy(data, off, buffer, filled, n);
                    filled += n;
                    off += n;
                    len -= n;
                }
            }

            private void emit(boolean last) throws IOException {
                out.write(seal(key, headerBytes, noncePrefix, counter, last, buffer, filled));
                counter++;
                filled = 0;
            }

            @Override
            public void flush() throws IOException {
                out.flush();
            }

            @Override
            public void close() throws IOException {
                if (closed) return;
                closed = true;
                try {
                    emit(true);
                } finally {
                    Arrays.fill(buffer, (byte) 0);
                    out.close();
                }
            }
        };
    }

    // Reads and checks chunk by chunk; any failure is an ArchiveException (the same message for a wrong key and a changed file).
    static InputStream decryptor(InputStream in, SecretKey key, byte[] headerBytes, byte[] noncePrefix, int chunkSize) {
        final int frameLength = chunkSize + BackupFormat.TAG_LENGTH;
        return new InputStream() {
            private final byte[] frame = new byte[frameLength];
            private byte[] plain = new byte[0];
            private int pos = 0;
            private long counter = 0;
            private int pending = -1;          // one byte read ahead to learn whether a full frame is the last one
            private boolean finished = false;

            @Override
            public int read() throws IOException {
                byte[] one = new byte[1];
                int n = read(one, 0, 1);
                return n < 0 ? -1 : Byte.toUnsignedInt(one[0]);
            }

            @Override
            public int read(byte[] target, int off, int len) throws IOException {
                if (len == 0) return 0;
                while (pos >= plain.length) {
                    if (finished) return -1;
                    nextChunk();
                }
                int n = Math.min(len, plain.length - pos);
                System.arraycopy(plain, pos, target, off, n);
                pos += n;
                return n;
            }

            private void nextChunk() throws IOException {
                int got = 0;
                if (pending >= 0) {
                    frame[got++] = (byte) pending;
                    pending = -1;
                }
                while (got < frameLength) {
                    int n = in.read(frame, got, frameLength - got);
                    if (n < 0) break;
                    got += n;
                }
                boolean last;
                if (got == frameLength) {
                    int next = in.read();
                    if (next < 0) {
                        last = true;
                    } else {
                        pending = next;
                        last = false;
                    }
                } else {
                    last = true;
                }
                if (got < BackupFormat.TAG_LENGTH) throw corrupt(null);   // nothing, or too short to hold a tag: cut off
                try {
                    Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
                    cipher.init(Cipher.DECRYPT_MODE, key, new GCMParameterSpec(GCM_TAG_BITS, nonce(noncePrefix, counter)));
                    cipher.updateAAD(aad(headerBytes, counter, last));
                    plain = cipher.doFinal(frame, 0, got);
                } catch (AEADBadTagException e) {
                    throw corrupt(e);
                } catch (GeneralSecurityException e) {
                    throw corrupt(e);
                }
                pos = 0;
                counter++;
                if (last) finished = true;
            }

            private ArchiveException corrupt(Throwable cause) {
                return new ArchiveException("The backup file could not be decrypted: wrong password, or the file is damaged or has been changed.", cause);
            }

            @Override
            public void close() throws IOException {
                Arrays.fill(plain, (byte) 0);
                in.close();
            }
        };
    }
}
