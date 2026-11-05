package com.javier.closetapp.billing;

// Task 103: everything the app asks of Stripe, as an interface so the tests can stand in a fake that
// needs no network (like GoogleTokenVerifier). The real one is StripeSdkGateway.
public interface StripeGateway {

    // False when no secret key / price is set: billing is then off and the app behaves as before.
    boolean isConfigured();

    // The human price, e.g. "$4.99 / month", read from the configured Stripe price (null if unknown).
    String priceLabel();

    // Creates a Stripe customer for the account and returns its id.
    String createCustomer(String email, long userId);

    // Starts a Checkout page for the monthly subscription and returns the URL to send the browser to.
    String createCheckoutSession(String customerId, long userId, String successUrl, String cancelUrl);

    // Opens Stripe's customer portal (cancel, update the card) and returns the URL.
    String createPortalSession(String customerId, String returnUrl);

    // Cancels a subscription immediately (used when an account is deactivated).
    void cancelSubscription(String subscriptionId);

    // Verifies the webhook's signature and returns the event, or null for an event type the app ignores.
    // Throws InvalidWebhookException when the signature or payload is not valid.
    BillingEvent parseWebhook(String payload, String signatureHeader);

    // Thrown for a webhook that fails verification (a 400 for the caller, never a retry storm).
    class InvalidWebhookException extends RuntimeException {
        public InvalidWebhookException(String message) {
            super(message);
        }
    }
}
