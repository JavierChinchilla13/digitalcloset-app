package com.javier.closetapp.backup;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

// Reads what TarWriter writes (and nothing else): regular files with plain names. Checks each header's checksum and refuses sizes that
// are not sane, so a damaged or hostile archive stops here.
final class TarReader {

    record Entry(String name, long size) { }

    private static final long MAX_ENTRY_SIZE = 64L * 1024 * 1024 * 1024;

    private final InputStream in;
    private long remainingData = 0;
    private long padding = 0;

    TarReader(InputStream in) {
        this.in = in;
    }

    // The next file, or null at the end of the archive. Whatever is left of the previous entry is skipped.
    Entry next() throws IOException {
        skipFully(remainingData + padding);
        remainingData = 0;
        padding = 0;
        byte[] header = in.readNBytes(TarWriter.BLOCK);
        if (header.length == 0) throw new ArchiveException("The archive ended without its end marker.");
        if (header.length != TarWriter.BLOCK) throw new ArchiveException("The archive is cut short.");
        boolean empty = true;
        for (byte b : header) {
            if (b != 0) { empty = false; break; }
        }
        if (empty) return null;

        long expected;
        try {
            expected = Long.parseLong(text(header, 148, 8).trim(), 8);
        } catch (NumberFormatException e) {
            throw new ArchiveException("The archive has a damaged entry header.");
        }
        long sum = 0;
        for (int i = 0; i < header.length; i++) sum += (i >= 148 && i < 156) ? ' ' : Byte.toUnsignedInt(header[i]);
        if (sum != expected) throw new ArchiveException("The archive has a damaged entry header.");
        if (header[156] != '0' && header[156] != 0) throw new ArchiveException("The archive holds something other than plain files.");

        long size;
        try {
            size = Long.parseLong(text(header, 124, 12).trim(), 8);
        } catch (NumberFormatException e) {
            throw new ArchiveException("The archive has a damaged entry header.");
        }
        if (size < 0 || size > MAX_ENTRY_SIZE) throw new ArchiveException("The archive has an entry of an impossible size.");
        remainingData = size;
        padding = (TarWriter.BLOCK - (size % TarWriter.BLOCK)) % TarWriter.BLOCK;
        return new Entry(text(header, 0, 100), size);
    }

    // Copies the current entry's data to `out`.
    void copyCurrentTo(OutputStream out) throws IOException {
        byte[] buffer = new byte[32 * 1024];
        while (remainingData > 0) {
            int n = in.read(buffer, 0, (int) Math.min(buffer.length, remainingData));
            if (n < 0) throw new ArchiveException("The archive is cut short.");
            out.write(buffer, 0, n);
            remainingData -= n;
        }
    }

    private void skipFully(long count) throws IOException {
        byte[] buffer = new byte[8192];
        while (count > 0) {
            int n = in.read(buffer, 0, (int) Math.min(buffer.length, count));
            if (n < 0) throw new ArchiveException("The archive is cut short.");
            count -= n;
        }
    }

    private static String text(byte[] header, int offset, int length) {
        int end = offset;
        while (end < offset + length && header[end] != 0) end++;
        return new String(header, offset, end - offset, StandardCharsets.US_ASCII);
    }
}
