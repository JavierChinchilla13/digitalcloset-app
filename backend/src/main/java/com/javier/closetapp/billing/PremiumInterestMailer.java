package com.javier.closetapp.billing;

// Tells the owner that somebody requested Premium. Kept as an interface like the other mailers; app.mail.mode picks the implementation.
// It receives only the account NUMBER (for the log) and the total so far: no email address, name or password ever reaches the message.
// Implementations throw an unchecked exception when the email could not be sent; the caller still keeps the request.
public interface PremiumInterestMailer {

    void notifyNewRequest(long userId, long totalRequests);
}
