package com.javier.closetapp.auth.mail;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

// DEV ONLY: "sends" the reset email by printing the link to the backend
// console, so the whole flow is testable locally without an email account.
// The link is a credential - this must never be the active mailer in a
// deployed environment (set app.mail.mode to a real implementation there).
@Component
@ConditionalOnProperty(prefix = "app.mail", name = "mode", havingValue = "log", matchIfMissing = true)
public class LoggingPasswordResetMailer implements PasswordResetMailer {

    private static final Logger log = LoggerFactory.getLogger(LoggingPasswordResetMailer.class);

    @Override
    public void sendPasswordResetLink(String toEmail, String resetLink) {
        log.warn("[DEV MAIL] Password reset requested for {} - open this link to choose a new password: {}",
                toEmail, resetLink);
    }
}
