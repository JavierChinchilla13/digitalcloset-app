package com.javier.closetapp.auth.mail;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

// DEV ONLY: "sends" the verification code by printing it to the backend
// console - see LoggingPasswordResetMailer for the same reasoning. Never the
// active mailer in a deployed environment (app.mail.mode must be smtp there).
@Component
@ConditionalOnProperty(prefix = "app.mail", name = "mode", havingValue = "log", matchIfMissing = true)
public class LoggingVerificationCodeMailer implements VerificationCodeMailer {

    private static final Logger log = LoggerFactory.getLogger(LoggingVerificationCodeMailer.class);

    @Override
    public void sendEmailChangeCode(String toEmail, String code) {
        log.warn("[DEV MAIL] Email change requested for {} - confirmation code: {}", toEmail, code);
    }

    @Override
    public void sendPasswordChangeCode(String toEmail, String code) {
        log.warn("[DEV MAIL] Password change requested for {} - confirmation code: {}", toEmail, code);
    }
}
