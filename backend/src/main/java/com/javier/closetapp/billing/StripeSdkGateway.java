package com.javier.closetapp.billing;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.stripe.exception.SignatureVerificationException;
import com.stripe.exception.StripeException;
import com.stripe.model.Customer;
import com.stripe.model.Price;
import com.stripe.model.Subscription;
import com.stripe.model.checkout.Session;
import com.stripe.net.RequestOptions;
import com.stripe.net.Webhook;
import com.stripe.param.CustomerCreateParams;
import com.stripe.param.checkout.SessionCreateParams;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.Locale;

// Task 103: the real Stripe, through the official Java SDK. Every call carries the secret key in its own
// RequestOptions (no global state). Webhook payloads are read as plain JSON once the signature is
// verified, so a Stripe API-version change to an object's shape cannot break event handling.
@Component
public class StripeSdkGateway implements StripeGateway {

    private static final Logger log = LoggerFactory.getLogger(StripeSdkGateway.class);

    private final String secretKey;
    private final String webhookSecret;
    private final String priceId;
    private final ObjectMapper mapper = new ObjectMapper();
    private volatile String cachedPriceLabel;

    public StripeSdkGateway(
            @Value("${app.stripe.secret-key:}") String secretKey,
            @Value("${app.stripe.webhook-secret:}") String webhookSecret,
            @Value("${app.stripe.price-id:}") String priceId) {
        this.secretKey = secretKey == null ? "" : secretKey.trim();
        this.webhookSecret = webhookSecret == null ? "" : webhookSecret.trim();
        this.priceId = priceId == null ? "" : priceId.trim();
    }

    private RequestOptions options() {
        return RequestOptions.builder().setApiKey(secretKey).build();
    }

    @Override
    public boolean isConfigured() {
        return !secretKey.isEmpty() && !priceId.isEmpty();
    }

    @Override
    public String priceLabel() {
        if (!isConfigured()) return null;
        if (cachedPriceLabel == null) {
            try {
                Price price = Price.retrieve(priceId, options());
                double amount = price.getUnitAmount() == null ? 0 : price.getUnitAmount() / 100.0;
                String interval = price.getRecurring() == null ? "" : " / " + price.getRecurring().getInterval();
                cachedPriceLabel = String.format(Locale.US, "%.2f %s%s", amount, price.getCurrency().toUpperCase(Locale.ROOT), interval);
            } catch (StripeException e) {
                log.warn("Could not read the Stripe price: {}", e.getMessage());
                return null;
            }
        }
        return cachedPriceLabel;
    }

    @Override
    public String createCustomer(String email, long userId) {
        try {
            Customer customer = Customer.create(CustomerCreateParams.builder()
                    .setEmail(email)
                    .putMetadata("userId", String.valueOf(userId))
                    .build(), options());
            return customer.getId();
        } catch (StripeException e) {
            throw new IllegalStateException("Stripe could not create the customer", e);
        }
    }

    @Override
    public String createCheckoutSession(String customerId, long userId, String successUrl, String cancelUrl) {
        try {
            Session session = Session.create(SessionCreateParams.builder()
                    .setMode(SessionCreateParams.Mode.SUBSCRIPTION)
                    .setCustomer(customerId)
                    .setClientReferenceId(String.valueOf(userId))
                    .addLineItem(SessionCreateParams.LineItem.builder().setPrice(priceId).setQuantity(1L).build())
                    .setSuccessUrl(successUrl)
                    .setCancelUrl(cancelUrl)
                    .build(), options());
            return session.getUrl();
        } catch (StripeException e) {
            throw new IllegalStateException("Stripe could not start the checkout", e);
        }
    }

    @Override
    public String createPortalSession(String customerId, String returnUrl) {
        try {
            com.stripe.model.billingportal.Session session = com.stripe.model.billingportal.Session.create(
                    com.stripe.param.billingportal.SessionCreateParams.builder()
                            .setCustomer(customerId)
                            .setReturnUrl(returnUrl)
                            .build(), options());
            return session.getUrl();
        } catch (StripeException e) {
            throw new IllegalStateException("Stripe could not open the billing portal", e);
        }
    }

    @Override
    public void cancelSubscription(String subscriptionId) {
        try {
            Subscription.retrieve(subscriptionId, options()).cancel();
        } catch (StripeException e) {
            throw new IllegalStateException("Stripe could not cancel the subscription", e);
        }
    }

    @Override
    public BillingEvent parseWebhook(String payload, String signatureHeader) {
        if (webhookSecret.isEmpty()) {
            throw new InvalidWebhookException("Webhook secret is not configured");
        }
        try {
            // Checks the HMAC signature and that the timestamp is recent (replay protection).
            Webhook.constructEvent(payload, signatureHeader, webhookSecret);
        } catch (SignatureVerificationException e) {
            throw new InvalidWebhookException("Invalid signature");
        } catch (RuntimeException e) {
            throw new InvalidWebhookException("Unreadable event");
        }
        try {
            return toBillingEvent(mapper.readTree(payload));
        } catch (Exception e) {
            throw new InvalidWebhookException("Unreadable event");
        }
    }

    // Reads the fields the app acts on out of a verified event; null for any other event type.
    public BillingEvent toBillingEvent(JsonNode event) {
        String id = event.path("id").asText(null);
        String type = event.path("type").asText("");
        JsonNode object = event.path("data").path("object");
        if (id == null) return null;

        switch (type) {
            case "checkout.session.completed": {
                // Only subscription checkouts matter.
                if (!"subscription".equals(object.path("mode").asText())) return null;
                String ref = object.path("client_reference_id").asText(null);
                Long userId = null;
                try {
                    if (ref != null) userId = Long.parseLong(ref);
                } catch (NumberFormatException ignored) {
                    // a checkout not started by this app
                }
                return new BillingEvent(id, BillingEvent.Type.CHECKOUT_COMPLETED, userId,
                        object.path("customer").asText(null), object.path("subscription").asText(null),
                        null, null, false);
            }
            case "customer.subscription.updated":
            case "customer.subscription.deleted": {
                BillingEvent.Type t = type.endsWith("deleted")
                        ? BillingEvent.Type.SUBSCRIPTION_DELETED : BillingEvent.Type.SUBSCRIPTION_UPDATED;
                // The period end sits on the subscription in older API versions and on its first item in newer ones.
                JsonNode end = object.path("current_period_end");
                if (end.isMissingNode() || end.isNull()) {
                    end = object.path("items").path("data").path(0).path("current_period_end");
                }
                Instant periodEnd = end.canConvertToLong() && !end.isMissingNode() ? Instant.ofEpochSecond(end.asLong()) : null;
                return new BillingEvent(id, t, null, object.path("customer").asText(null),
                        object.path("id").asText(null), object.path("status").asText(null),
                        periodEnd, object.path("cancel_at_period_end").asBoolean(false));
            }
            default:
                return null;
        }
    }
}
