package com.javier.closetapp;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.core.env.PropertySource;
import org.springframework.core.io.ClassPathResource;
import org.springframework.boot.env.PropertiesPropertySourceLoader;

import java.io.IOException;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

// Task 24: the production profile (application-prod.properties) is plain text
// that nothing else exercises - booting the whole app with it needs a real
// database and SMTP account. These tests read the file itself, so a careless
// edit that re-enables SQL logging, the log mailer or stack traces fails the
// build instead of reaching a server.
class ProductionProfileTest {

    private static PropertySource<?> prod() throws IOException {
        List<PropertySource<?>> sources = new PropertiesPropertySourceLoader()
                .load("prod", new ClassPathResource("application-prod.properties"));
        assertEquals(1, sources.size());
        return sources.get(0);
    }

    private static Object prop(String name) throws IOException {
        Object value = prod().getProperty(name);
        assertNotNull(value, name + " must be set in application-prod.properties");
        return value;
    }

    @Test
    @DisplayName("production does not echo SQL or trace requests")
    void quietLogs() throws IOException {
        assertEquals("false", prop("spring.jpa.show-sql").toString());
        assertEquals("INFO", prop("logging.level.root").toString());
        assertEquals("OFF", prop("logging.level.org.hibernate.type.descriptor.sql").toString());
    }

    @Test
    @DisplayName("production sends real email by default, never the console mailer")
    void realMailByDefault() throws IOException {
        assertEquals("${MAIL_MODE:smtp}", prop("app.mail.mode").toString());
    }

    @Test
    @DisplayName("error responses never include exception messages or stack traces")
    void noErrorDetails() throws IOException {
        assertEquals("never", prop("server.error.include-message").toString());
        assertEquals("never", prop("server.error.include-stacktrace").toString());
    }

    @Test
    @DisplayName("the connection pool is small and retires connections before a managed database drops them")
    void smallPool() throws IOException {
        assertEquals("${DB_POOL_SIZE:5}", prop("spring.datasource.hikari.maximum-pool-size").toString());
        assertEquals("300000", prop("spring.datasource.hikari.max-lifetime").toString());
    }

    @Test
    @DisplayName("production does not silently adopt an unmanaged database")
    void flywayDoesNotBaseline() throws IOException {
        assertEquals("false", prop("spring.flyway.baseline-on-migrate").toString());
    }
}
