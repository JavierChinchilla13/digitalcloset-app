package com.javier.closetapp.support;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.javier.closetapp.billing.BillingEvent;
import com.javier.closetapp.billing.StripeGateway;
import com.javier.closetapp.billing.StripeSdkGateway;

import java.util.ArrayList;
import java.util.List;

// Task 103: stands in for Stripe in the integration tests, so no network or real key is needed. A webhook
// whose signature header is exactly "valid" is accepted and its JSON is read with the real event mapping
// (StripeSdkGateway.toBillingEvent); anything else is rejected like a bad signature. (The real signature
// check is tested on StripeSdkGateway itself, with locally computed HMACs.)
public class FakeStripeGateway implements StripeGateway {

    public static final String VALID_SIGNATURE = "valid";

    private final ObjectMapper mapper = new ObjectMapper();
    private final StripeSdkGateway mapping = new StripeSdkGateway("", "", "");

    // Test switches and recorded calls (reset by the tests that use them).
    public volatile boolean configured = true;
    public final List<String> canceledSubscriptions = new ArrayList<>();
    public final List<String> createdCustomers = new ArrayList<>();
    public volatile boolean failCancel = false;

    public void reset() {
        configured = true;
        failCancel = false;
        canceledSubscriptions.clear();
        createdCustomers.clear();
    }

    @Override
    public boolean isConfigured() {
        return configured;
    }

    @Override
    public String priceLabel() {
        return "4.99 USD / month";
    }

    @Override
    public String createCustomer(String email, long userId) {
        String id = "cus_test_" + userId;
        createdCustomers.add(id);
        return id;
    }

    @Override
    public String createCheckoutSession(String customerId, long userId, String successUrl, String cancelUrl) {
        return "https://checkout.stripe.test/session?customer=" + customerId + "&success=" + successUrl;
    }

    @Override
    public String createPortalSession(String customerId, String returnUrl) {
        return "https://billing.stripe.test/portal?customer=" + customerId;
    }

    @Override
    public void cancelSubscription(String subscriptionId) {
        if (failCancel) throw new IllegalStateException("Stripe is down");
        canceledSubscriptions.add(subscriptionId);
    }

    @Override
    public BillingEvent parseWebhook(String payload, String signatureHeader) {
        if (!VALID_SIGNATURE.equals(signatureHeader)) {
            throw new InvalidWebhookException("Invalid signature");
        }
        try {
            return mapping.toBillingEvent(mapper.readTree(payload));
        } catch (Exception e) {
            throw new InvalidWebhookException("Unreadable event");
        }
    }
}
