package com.javier.closetapp.support;

import com.javier.closetapp.auth.google.GoogleTokenVerifier;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;

// Task 98: swaps the real Google token verifier for FakeGoogleTokenVerifier in every integration test
// (imported by IntegrationTestBase, so they all share one cached application context).
@TestConfiguration
public class TestGoogleConfig {

    @Bean
    @Primary
    public GoogleTokenVerifier fakeGoogleTokenVerifier() {
        return new FakeGoogleTokenVerifier();
    }
}
