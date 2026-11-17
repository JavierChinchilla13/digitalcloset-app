package com.javier.closetapp.backup;

import java.io.IOException;
import java.io.OutputStream;
import java.sql.Connection;
import java.sql.SQLException;
import java.util.List;

// Writes one table as CSV (a header line, then one record per row, ordered by the first column) to a stream, without holding the
// table in memory. On PostgreSQL it uses COPY ... TO STDOUT through the JDBC driver (pg_dump is not available in the Render
// container); on any other database (the H2 of the test suite) a plain ResultSet gives the same shape.
interface TableDumper {

    record Dumped(long rows, List<String> columns) { }

    Dumped dump(Connection connection, String table, OutputStream out) throws SQLException, IOException;

    static TableDumper forConnection(Connection connection) throws SQLException {
        String product = connection.getMetaData().getDatabaseProductName();
        return product != null && product.toLowerCase().contains("postgres") ? new PostgresCopyDumper() : new JdbcCsvDumper();
    }
}
