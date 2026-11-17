package com.javier.closetapp.backup;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

// What a backup says about itself (the last file in the archive): when, which schema, and per table the row count and SHA-256 of its
// file. It holds no personal data. Restoring checks every file against it. Written and read with MiniJson (JDK only).
public record Manifest(String format, int formatVersion, String createdAt, String schemaVersion,
                       List<TableEntry> tables, List<String> excludedTables) {

    public static final String FORMAT = "vysvi-backup";

    public record TableEntry(String name, String file, long rows, long bytes, String sha256, List<String> columns) { }

    String toJson() {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("format", format);
        m.put("formatVersion", formatVersion);
        m.put("createdAt", createdAt);
        m.put("schemaVersion", schemaVersion);
        List<Object> list = new ArrayList<>();
        for (TableEntry t : tables) {
            Map<String, Object> e = new LinkedHashMap<>();
            e.put("name", t.name());
            e.put("file", t.file());
            e.put("rows", t.rows());
            e.put("bytes", t.bytes());
            e.put("sha256", t.sha256());
            e.put("columns", t.columns());
            list.add(e);
        }
        m.put("tables", list);
        m.put("excludedTables", excludedTables);
        return MiniJson.write(m);
    }

    @SuppressWarnings("unchecked")
    static Manifest fromJson(String json) throws ArchiveException {
        try {
            Map<String, Object> m = (Map<String, Object>) MiniJson.parse(json);
            List<TableEntry> tables = new ArrayList<>();
            for (Object o : (List<Object>) m.get("tables")) {
                Map<String, Object> e = (Map<String, Object>) o;
                List<String> columns = new ArrayList<>();
                for (Object c : (List<Object>) e.get("columns")) columns.add((String) c);
                tables.add(new TableEntry((String) e.get("name"), (String) e.get("file"), (Long) e.get("rows"), (Long) e.get("bytes"),
                        (String) e.get("sha256"), columns));
            }
            List<String> excluded = new ArrayList<>();
            for (Object o : (List<Object>) m.get("excludedTables")) excluded.add((String) o);
            return new Manifest((String) m.get("format"), ((Long) m.get("formatVersion")).intValue(), (String) m.get("createdAt"),
                    (String) m.get("schemaVersion"), tables, excluded);
        } catch (ClassCastException | NullPointerException e) {
            throw new ArchiveException("The manifest is not valid.");
        }
    }
}
