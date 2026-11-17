package com.javier.closetapp.backup;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

// Command-line door to ArchiveReader, used by scripts/restore-from-archive.sh (it needs no Spring and no network):
//
//   java -cp backend/target/classes com.javier.closetapp.backup.ArchiveTool <archive.vbk> <empty output directory>
//
// The archive password is read from the FIRST LINE OF STANDARD INPUT (the script reads it hidden and pipes it in), never from the
// command line, so it does not show in a process list or the shell history. On success the files are unpacked and verified and the
// manifest is printed; on any failure it prints one generic line, exits with 2 and leaves nothing behind.
public final class ArchiveTool {

    private ArchiveTool() { }

    public static void main(String[] args) throws IOException {
        if (args.length != 2) {
            System.err.println("Usage: ArchiveTool <archive.vbk> <output directory> (the password is read from standard input)");
            System.exit(1);
        }
        Path archive = Path.of(args[0]);
        Path outDir = Path.of(args[1]);
        BufferedReader stdin = new BufferedReader(new InputStreamReader(System.in, StandardCharsets.UTF_8));
        String line = stdin.readLine();
        if (line == null || line.isEmpty()) {
            System.err.println("No password was given on standard input.");
            System.exit(1);
        }
        char[] password = line.toCharArray();
        try (InputStream in = Files.newInputStream(archive)) {
            Manifest manifest = ArchiveReader.extractAndVerify(in, password, outDir);
            System.out.println("OK created=" + manifest.createdAt() + " schema=" + manifest.schemaVersion());
            for (Manifest.TableEntry t : manifest.tables()) {
                System.out.println("TABLE " + t.name() + " " + t.rows() + " " + String.join(",", t.columns()));
            }
        } catch (IOException e) {
            System.err.println("The backup could not be opened: wrong password, or the file is damaged or has been changed.");
            System.exit(2);
        } finally {
            java.util.Arrays.fill(password, '\0');
        }
    }
}
