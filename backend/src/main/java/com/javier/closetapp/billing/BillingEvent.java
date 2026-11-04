package com.javier.closetapp.billing;

import java.time.Instant;

// Task 103: what the app needs from a Stripe webhook, in its own small shape (so nothing outside
// StripeSdkGateway touches Stripe's classes). Events the app does not act on are never created.
public record BillingEvent(
        String eventId,
        Type type,
        // Our user id, set on a completed checkout (client_reference_id); null on subscription events.
        Long userId,
        String customerId,
        String subscriptionId,
        // Stripe's subscription status word (active, past_due, canceled, ...), null on a checkout event.
        String status,
        Instant currentPeriodEnd,
        boolean cancelAtPeriodEnd) {

    public enum Type { CHECKOUT_COMPLETED, SUBSCRIPTION_UPDATED, SUBSCRIPTION_DELETED }
}
