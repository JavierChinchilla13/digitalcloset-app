package com.javier.closetapp.backup;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;

// A minimal tar (ustar) writer: regular files only, names of at most 100 ASCII characters, no directories, no extended headers.
// Enough for the backup, readable by any tar, and small enough to be reviewed in one sitting.
final class TarWriter implements AutoCloseable {

    static final int BLOCK = 512;

    private final OutputStream out;

    TarWriter(OutputStream out) {
        this.out = out;
    }

    // Writes one file; `size` must be exactly the number of bytes `data` delivers.
    void putFile(String name, long size, InputStream data, long modifiedEpochSeconds) throws IOException {
        byte[] nameBytes = name.getBytes(StandardCharsets.US_ASCII);
        if (nameBytes.length == 0 || nameBytes.length > 100 || !name.matches("[A-Za-z0-9._-]+")) {
            throw new IOException("Unsupported tar entry name");
        }
        byte[] header = new byte[BLOCK];
        System.arraycopy(nameBytes, 0, header, 0, nameBytes.length);
        octal(header, 100, 8, 0600);                       // mode
        octal(header, 108, 8, 0);                          // uid
        octal(header, 116, 8, 0);                          // gid
        octal(header, 124, 12, size);                      // size
        octal(header, 136, 12, modifiedEpochSeconds);      // mtime
        Arrays.fill(header, 148, 156, (byte) ' ');         // checksum placeholder (spaces while summing)
        header[156] = '0';                                 // regular file
        System.arraycopy("ustar\0".getBytes(StandardCharsets.US_ASCII), 0, header, 257, 6);
        header[263] = '0';
        header[264] = '0';                                 // version "00"
        long sum = 0;
        for (byte b : header) sum += Byte.toUnsignedInt(b);
        byte[] check = String.format("%06o", sum).getBytes(StandardCharsets.US_ASCII);
        System.arraycopy(check, 0, header, 148, 6);
        header[154] = 0;
        header[155] = ' ';
        out.write(header);

        long remaining = size;
        byte[] buffer = new byte[32 * 1024];
        while (remaining > 0) {
            int n = data.read(buffer, 0, (int) Math.min(buffer.length, remaining));
            if (n < 0) throw new IOException("Tar entry data ended early");
            out.write(buffer, 0, n);
            remaining -= n;
        }
        if (data.read() != -1) throw new IOException("Tar entry data longer than declared");
        int pad = (int) ((BLOCK - (size % BLOCK)) % BLOCK);
        if (pad > 0) out.write(new byte[pad]);
    }

    // The end of the archive: two empty blocks. Does not close the underlying stream (close() does).
    void finish() throws IOException {
        out.write(new byte[BLOCK * 2]);
    }

    @Override
    public void close() throws IOException {
        out.close();
    }

    // Writes `value` as a zero-padded octal number of `width - 1` digits followed by a NUL.
    private static void octal(byte[] header, int offset, int width, long value) {
        byte[] digits = String.format("%0" + (width - 1) + "o", value).getBytes(StandardCharsets.US_ASCII);
        System.arraycopy(digits, 0, header, offset, width - 1);
        header[offset + width - 1] = 0;
    }
}
