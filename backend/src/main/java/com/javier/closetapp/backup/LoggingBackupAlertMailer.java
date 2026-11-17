package com.javier.closetapp.backup;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.time.Instant;

// Development / test mail mode (app.mail.mode = log): nothing is sent. Unlike the other development mailers it prints no email address,
// only the admin's account number.
@Component
@ConditionalOnProperty(prefix = "app.mail", name = "mode", havingValue = "log", matchIfMissing = true)
public class LoggingBackupAlertMailer implements BackupAlertMailer {

    private static final Logger log = LoggerFactory.getLogger(LoggingBackupAlertMailer.class);

    @Override
    public void sendBackupRequested(long adminUserId, String toEmail, Instant at) {
        log.warn("[DEV MAIL] Backup alert for admin id {} at {}", adminUserId, at);
    }
}
