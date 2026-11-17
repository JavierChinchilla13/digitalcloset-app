package com.javier.closetapp.backup;

import java.io.BufferedInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;

// Counts the data records of a CSV file written by COPY or JdbcCsvDumper (the header line is not counted). A line break inside a
// quoted field does not end a record.
final class CsvRecords {

    private CsvRecords() { }

    static long countDataRecords(Path file) throws IOException {
        long records = 0;
        boolean inQuotes = false;
        boolean pendingContent = false;
        try (InputStream in = new BufferedInputStream(Files.newInputStream(file), 64 * 1024)) {
            int b;
            while ((b = in.read()) != -1) {
                if (b == '"') {
                    inQuotes = !inQuotes;      // a doubled quote flips twice: it nets out
                    pendingContent = true;
                } else if (b == '\n' && !inQuotes) {
                    records++;
                    pendingContent = false;
                } else if (b != '\r') {
                    pendingContent = true;
                }
            }
        }
        if (pendingContent) records++;
        return Math.max(0, records - 1);
    }
}
