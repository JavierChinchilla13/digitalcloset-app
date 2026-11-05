package com.javier.closetapp.billing;

// Task 103: a billing request that cannot be done (billing not set up, already subscribed, ...). The
// message is written for the user and returned as-is with a 400.
public class BillingException extends RuntimeException {
    public BillingException(String message) {
        super(message);
    }
}
