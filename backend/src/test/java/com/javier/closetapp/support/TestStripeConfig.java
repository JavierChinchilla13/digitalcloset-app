package com.javier.closetapp.support;

import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;

// Task 103: swaps the real Stripe gateway for FakeStripeGateway in every integration test (imported by
// IntegrationTestBase, so they all share one cached application context). Being @Primary and a
// StripeGateway, it is what every injection point of the interface receives.
@TestConfiguration
public class TestStripeConfig {

    @Bean
    @Primary
    public FakeStripeGateway fakeStripeGateway() {
        return new FakeStripeGateway();
    }
}
