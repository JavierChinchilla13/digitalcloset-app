package com.javier.closetapp.backup;

import java.io.IOException;
import java.io.OutputStream;
import java.lang.reflect.InvocationTargetException;
import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.ResultSetMetaData;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.List;

// PostgreSQL's COPY ... TO STDOUT streamed through the JDBC driver's CopyManager: rows go from the server to our stream in small
// pieces, so memory does not grow with the table. The driver is a runtime-only dependency, so it is reached by reflection.
final class PostgresCopyDumper implements TableDumper {

    @Override
    public Dumped dump(Connection connection, String table, OutputStream out) throws SQLException, IOException {
        List<String> columns = new ArrayList<>();
        try (Statement st = connection.createStatement(); ResultSet rs = st.executeQuery("select * from " + table + " where false")) {
            ResultSetMetaData md = rs.getMetaData();
            for (int i = 1; i <= md.getColumnCount(); i++) columns.add(md.getColumnName(i));
        }
        StringBuilder list = new StringBuilder();
        for (String c : columns) list.append(list.length() == 0 ? "" : ", ").append('"').append(c).append('"');
        String sql = "COPY (SELECT " + list + " FROM " + table + " ORDER BY 1) TO STDOUT WITH (FORMAT csv, HEADER true)";
        try {
            Class<?> pgConnection = Class.forName("org.postgresql.PGConnection");
            Object pg = connection.unwrap(pgConnection);
            Object copy = pgConnection.getMethod("getCopyAPI").invoke(pg);
            Object rows = copy.getClass().getMethod("copyOut", String.class, OutputStream.class).invoke(copy, sql, out);
            return new Dumped((Long) rows, columns);
        } catch (InvocationTargetException e) {
            Throwable cause = e.getCause();
            if (cause instanceof SQLException failure) throw failure;
            if (cause instanceof IOException failure) throw failure;
            throw new IOException("COPY failed", cause);
        } catch (ReflectiveOperationException e) {
            throw new IOException("The PostgreSQL driver's COPY API is not available", e);
        }
    }
}
