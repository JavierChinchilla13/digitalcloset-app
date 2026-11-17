package com.javier.closetapp.backup;

import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class TarWriterTest {

    private static byte[] write(String[] names, byte[][] contents) throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        try (TarWriter tar = new TarWriter(out)) {
            for (int i = 0; i < names.length; i++) {
                tar.putFile(names[i], contents[i].length, new ByteArrayInputStream(contents[i]), 1_700_000_000L);
            }
            tar.finish();
        }
        return out.toByteArray();
    }

    @Test
    @DisplayName("what the writer writes the reader reads back, at sizes around the 512-byte block")
    void roundTrip() throws IOException {
        byte[] a = new byte[0];
        byte[] b = "hello".getBytes(StandardCharsets.UTF_8);
        byte[] c = new byte[512];
        byte[] d = new byte[1300];
        java.util.Arrays.fill(c, (byte) 'c');
        java.util.Arrays.fill(d, (byte) 'd');
        byte[] archive = write(new String[] {"a.csv", "b.csv", "c.csv", "manifest.json"}, new byte[][] {a, b, c, d});

        TarReader reader = new TarReader(new ByteArrayInputStream(archive));
        byte[][] expected = {a, b, c, d};
        String[] names = {"a.csv", "b.csv", "c.csv", "manifest.json"};
        for (int i = 0; i < 4; i++) {
            TarReader.Entry entry = reader.next();
            assertEquals(names[i], entry.name());
            assertEquals(expected[i].length, entry.size());
            ByteArrayOutputStream got = new ByteArrayOutputStream();
            reader.copyCurrentTo(got);
            assertArrayEquals(expected[i], got.toByteArray());
        }
        assertNull(reader.next());
    }

    @Test
    @DisplayName("the system tar can list and extract the archive")
    void systemTarReadsIt(@TempDir Path dir) throws Exception {
        byte[] archive = write(new String[] {"users.csv", "manifest.json"}, new byte[][] {"id,email\n1,x\n".getBytes(StandardCharsets.UTF_8), "{}".getBytes()});
        Path file = dir.resolve("t.tar");
        Files.write(file, archive);

        Process probe;
        try {
            probe = new ProcessBuilder("tar", "--version").redirectErrorStream(true).start();
        } catch (IOException noTar) {
            Assumptions.abort("no tar on this machine");
            return;
        }
        probe.getInputStream().readAllBytes();
        probe.waitFor(30, TimeUnit.SECONDS);

        Process list = new ProcessBuilder("tar", "-tf", file.toString()).redirectErrorStream(true).start();
        String listing = new String(list.getInputStream().readAllBytes(), StandardCharsets.UTF_8);
        assertEquals(0, list.waitFor(30, TimeUnit.SECONDS) ? list.exitValue() : -1, listing);
        List<String> names = new ArrayList<>(List.of(listing.trim().split("\\R")));
        assertEquals(List.of("users.csv", "manifest.json"), names);

        Path out = Files.createDirectory(dir.resolve("out"));
        Process extract = new ProcessBuilder("tar", "-xf", file.toString(), "-C", out.toString()).redirectErrorStream(true).start();
        String said = new String(extract.getInputStream().readAllBytes(), StandardCharsets.UTF_8);
        assertEquals(0, extract.waitFor(30, TimeUnit.SECONDS) ? extract.exitValue() : -1, said);
        assertEquals("id,email\n1,x\n", Files.readString(out.resolve("users.csv")));
    }

    @Test
    @DisplayName("names outside the simple set are refused by the writer; a damaged header or a cut archive is refused by the reader")
    void refusals() throws IOException {
        ByteArrayOutputStream sink = new ByteArrayOutputStream();
        TarWriter tar = new TarWriter(sink);
        assertThrows(IOException.class, () -> tar.putFile("../evil", 1, new ByteArrayInputStream(new byte[1]), 0));
        assertThrows(IOException.class, () -> tar.putFile("a/b.csv", 1, new ByteArrayInputStream(new byte[1]), 0));
        assertThrows(IOException.class, () -> tar.putFile("x".repeat(101), 1, new ByteArrayInputStream(new byte[1]), 0));
        assertThrows(IOException.class, () -> tar.putFile("short.csv", 5, new ByteArrayInputStream(new byte[2]), 0));

        byte[] archive = write(new String[] {"a.csv"}, new byte[][] {"data".getBytes()});
        byte[] damaged = archive.clone();
        damaged[10] ^= 1;     // inside the name: the header checksum no longer matches
        assertThrows(ArchiveException.class, () -> new TarReader(new ByteArrayInputStream(damaged)).next());
        assertThrows(ArchiveException.class, () -> {
            TarReader r = new TarReader(new ByteArrayInputStream(java.util.Arrays.copyOf(archive, 300)));
            r.next();
        });
        assertTrue(archive.length >= 512 * 4);
    }
}
