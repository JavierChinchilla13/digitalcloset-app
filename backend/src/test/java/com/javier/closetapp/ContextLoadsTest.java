package com.javier.closetapp;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

// Smoke test: the whole app boots against the test profile (H2, schema built
// from the entities - see application-test.properties for why not Flyway).
@SpringBootTest
@ActiveProfiles("test")
class ContextLoadsTest {

    @Test
    void contextLoads() {
    }
}
