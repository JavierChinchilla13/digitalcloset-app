package com.javier.closetapp.backup;

import java.time.Instant;

// Tells an admin, BEFORE their backup download starts, that one was requested from their account ("if this was not you, ...").
// Kept as an interface like the other mailers; app.mail.mode picks the implementation. Implementations throw an unchecked exception
// when the email could not be sent; BackupService then goes on and records alert_sent = false.
public interface BackupAlertMailer {

    void sendBackupRequested(long adminUserId, String toEmail, Instant at);
}
