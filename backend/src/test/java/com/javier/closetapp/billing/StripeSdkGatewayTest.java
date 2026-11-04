package com.javier.closetapp.billing;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.HexFormat;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

// Task 103: the real webhook verification (Stripe's own signature scheme, through the SDK) and the event
// mapping, with signatures computed locally - no network, no Stripe account.
class StripeSdkGatewayTest {

    private static final String SECRET = "whsec_test_secret_value";

    private final StripeSdkGateway gateway = new StripeSdkGateway("sk_test_x", SECRET, "price_x");

    // Stripe's header: "t=<unix seconds>,v1=<hex HMAC-SHA256 of "<t>.<payload>">".
    private static String sign(String payload, String secret, long timestamp) throws Exception {
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
        String hex = HexFormat.of().formatHex(mac.doFinal((timestamp + "." + payload).getBytes(StandardCharsets.UTF_8)));
        return "t=" + timestamp + ",v1=" + hex;
    }

    private static long now() {
        return Instant.now().getEpochSecond();
    }

    private static final String CHECKOUT = "{\"id\":\"evt_1\",\"object\":\"event\",\"type\":\"checkout.session.completed\","
            + "\"data\":{\"object\":{\"object\":\"checkout.session\",\"mode\":\"subscription\",\"client_reference_id\":\"42\","
            + "\"customer\":\"cus_1\",\"subscription\":\"sub_1\"}}}";

    @Test
    @DisplayName("a correctly signed checkout event is accepted and read")
    void validSignature() throws Exception {
        BillingEvent event = gateway.parseWebhook(CHECKOUT, sign(CHECKOUT, SECRET, now()));

        assertNotNull(event);
        assertEquals(BillingEvent.Type.CHECKOUT_COMPLETED, event.type());
        assertEquals("evt_1", event.eventId());
        assertEquals(42L, event.userId());
        assertEquals("cus_1", event.customerId());
        assertEquals("sub_1", event.subscriptionId());
    }

    @Test
    @DisplayName("a wrong secret, a tampered body and a missing header are rejected")
    void rejected() throws Exception {
        assertThrows(StripeGateway.InvalidWebhookException.class,
                () -> gateway.parseWebhook(CHECKOUT, sign(CHECKOUT, "whsec_other", now())));
        assertThrows(StripeGateway.InvalidWebhookException.class,
                () -> gateway.parseWebhook(CHECKOUT.replace("\"42\"", "\"7\""), sign(CHECKOUT, SECRET, now())));
        assertThrows(StripeGateway.InvalidWebhookException.class, () -> gateway.parseWebhook(CHECKOUT, ""));
        assertThrows(StripeGateway.InvalidWebhookException.class, () -> gateway.parseWebhook(CHECKOUT, "garbage"));
    }

    @Test
    @DisplayName("an old signed event is rejected (replay protection)")
    void tooOld() throws Exception {
        long ancient = now() - 3600;
        assertThrows(StripeGateway.InvalidWebhookException.class,
                () -> gateway.parseWebhook(CHECKOUT, sign(CHECKOUT, SECRET, ancient)));
    }

    @Test
    @DisplayName("without a webhook secret every event is rejected")
    void noSecret() throws Exception {
        StripeSdkGateway unconfigured = new StripeSdkGateway("", "", "");
        assertThrows(StripeGateway.InvalidWebhookException.class,
                () -> unconfigured.parseWebhook(CHECKOUT, sign(CHECKOUT, SECRET, now())));
        assertFalse(unconfigured.isConfigured());
    }

    @Test
    @DisplayName("billing counts as configured only with both a key and a price")
    void configured() {
        assertTrue(gateway.isConfigured());
        assertFalse(new StripeSdkGateway("sk_test_x", SECRET, "").isConfigured());
        assertFalse(new StripeSdkGateway("", SECRET, "price_x").isConfigured());
    }

    @Test
    @DisplayName("a subscription update is read, with the period end from the subscription or from its first item")
    void subscriptionUpdated() throws Exception {
        String legacy = "{\"id\":\"evt_2\",\"type\":\"customer.subscription.updated\",\"data\":{\"object\":{"
                + "\"id\":\"sub_1\",\"customer\":\"cus_1\",\"status\":\"active\",\"cancel_at_period_end\":true,"
                + "\"current_period_end\":1893456000}}}";
        BillingEvent a = gateway.parseWebhook(legacy, sign(legacy, SECRET, now()));
        assertEquals(BillingEvent.Type.SUBSCRIPTION_UPDATED, a.type());
        assertEquals("active", a.status());
        assertTrue(a.cancelAtPeriodEnd());
        assertEquals(Instant.ofEpochSecond(1893456000L), a.currentPeriodEnd());

        // Newer API versions keep the period end on the subscription's first item.
        String modern = "{\"id\":\"evt_3\",\"type\":\"customer.subscription.updated\",\"data\":{\"object\":{"
                + "\"id\":\"sub_1\",\"customer\":\"cus_1\",\"status\":\"past_due\",\"cancel_at_period_end\":false,"
                + "\"items\":{\"data\":[{\"current_period_end\":1893542400}]}}}}";
        BillingEvent b = gateway.parseWebhook(modern, sign(modern, SECRET, now()));
        assertEquals("past_due", b.status());
        assertEquals(Instant.ofEpochSecond(1893542400L), b.currentPeriodEnd());
    }

    @Test
    @DisplayName("a deleted subscription is read")
    void subscriptionDeleted() throws Exception {
        String body = "{\"id\":\"evt_4\",\"type\":\"customer.subscription.deleted\",\"data\":{\"object\":{"
                + "\"id\":\"sub_1\",\"customer\":\"cus_1\",\"status\":\"canceled\"}}}";
        BillingEvent event = gateway.parseWebhook(body, sign(body, SECRET, now()));
        assertEquals(BillingEvent.Type.SUBSCRIPTION_DELETED, event.type());
        assertNull(event.currentPeriodEnd());
    }

    @Test
    @DisplayName("other event types, and one-time payment checkouts, are ignored")
    void ignored() throws Exception {
        String other = "{\"id\":\"evt_5\",\"type\":\"invoice.paid\",\"data\":{\"object\":{}}}";
        assertNull(gateway.parseWebhook(other, sign(other, SECRET, now())));

        String payment = CHECKOUT.replace("\"mode\":\"subscription\"", "\"mode\":\"payment\"");
        assertNull(gateway.parseWebhook(payment, sign(payment, SECRET, now())));
    }
}
