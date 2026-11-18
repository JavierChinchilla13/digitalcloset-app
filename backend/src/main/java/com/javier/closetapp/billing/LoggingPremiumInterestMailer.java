package com.javier.closetapp.billing;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

// Development / test mail mode (app.mail.mode = log): nothing is sent; the account number and the total are logged, nothing else.
@Component
@ConditionalOnProperty(prefix = "app.mail", name = "mode", havingValue = "log", matchIfMissing = true)
public class LoggingPremiumInterestMailer implements PremiumInterestMailer {

    private static final Logger log = LoggerFactory.getLogger(LoggingPremiumInterestMailer.class);

    @Override
    public void notifyNewRequest(long userId, long totalRequests) {
        log.warn("[DEV MAIL] New Premium request from user id {} (total so far: {})", userId, totalRequests);
    }
}
