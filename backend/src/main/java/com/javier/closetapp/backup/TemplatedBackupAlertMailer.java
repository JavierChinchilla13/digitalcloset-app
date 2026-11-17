package com.javier.closetapp.backup;

import com.javier.closetapp.auth.mail.MailTransport;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnExpression;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;

// The real alert email (app.mail.mode = smtp or relay), sent through the same MailTransport as the other emails. The text carries no
// secret: only that a backup was requested and when.
@Component
@ConditionalOnExpression("'${app.mail.mode:log}' == 'smtp' or '${app.mail.mode:log}' == 'relay'")
public class TemplatedBackupAlertMailer implements BackupAlertMailer {

    private static final DateTimeFormatter WHEN = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm 'UTC'").withZone(ZoneOffset.UTC);

    private final MailTransport transport;
    private final String contactEmail;

    public TemplatedBackupAlertMailer(MailTransport transport, @Value("${app.brand.contact-email}") String contactEmail) {
        this.transport = transport;
        this.contactEmail = contactEmail;
    }

    @Override
    public void sendBackupRequested(long adminUserId, String toEmail, Instant at) {
        String when = WHEN.format(at);
        String text = "A backup of the VYSVI database was requested from your administrator account on " + when + ".\n\n"
                + "The download is encrypted with a password chosen at that moment. If this was not you, change your password now "
                + "and tell the owner of the site.\n";
        String html = "<p>A backup of the VYSVI database was requested from your administrator account on <strong>" + when + "</strong>.</p>"
                + "<p>The download is encrypted with a password chosen at that moment. <strong>If this was not you</strong>, change your "
                + "password now and tell the owner of the site.</p>";
        transport.send(toEmail, contactEmail, "A VYSVI backup was requested from your account", text, html);
    }
}
