package com.javier.closetapp.backup;

import java.io.IOException;
import java.io.OutputStream;
import java.io.OutputStreamWriter;
import java.io.Writer;
import java.nio.charset.StandardCharsets;
import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.ResultSetMetaData;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.List;

// The same CSV as COPY ... (FORMAT csv, HEADER true) writes, for databases that have no COPY: NULL is an empty field, an empty string is
// "", a field with a comma, quote, CR or LF is quoted with quotes doubled, records end with LF. Rows are streamed (fetch size) so memory
// stays flat.
final class JdbcCsvDumper implements TableDumper {

    @Override
    public Dumped dump(Connection connection, String table, OutputStream out) throws SQLException, IOException {
        Writer w = new OutputStreamWriter(out, StandardCharsets.UTF_8);
        long rows = 0;
        List<String> columns = new ArrayList<>();
        try (Statement st = connection.createStatement()) {
            st.setFetchSize(500);
            try (ResultSet rs = st.executeQuery("select * from " + table + " order by 1")) {
                ResultSetMetaData md = rs.getMetaData();
                int count = md.getColumnCount();
                for (int i = 1; i <= count; i++) columns.add(md.getColumnName(i));
                for (int i = 0; i < count; i++) {
                    if (i > 0) w.write(',');
                    w.write(field(columns.get(i)));
                }
                w.write('\n');
                while (rs.next()) {
                    for (int i = 1; i <= count; i++) {
                        if (i > 1) w.write(',');
                        Object v = rs.getObject(i);
                        if (v != null) w.write(field(v.toString()));
                    }
                    w.write('\n');
                    rows++;
                }
            }
        }
        w.flush();
        return new Dumped(rows, columns);
    }

    private static String field(String value) {
        boolean quote = value.isEmpty() || value.indexOf(',') >= 0 || value.indexOf('"') >= 0 || value.indexOf('\n') >= 0 || value.indexOf('\r') >= 0;
        return quote ? '"' + value.replace("\"", "\"\"") + '"' : value;
    }
}
