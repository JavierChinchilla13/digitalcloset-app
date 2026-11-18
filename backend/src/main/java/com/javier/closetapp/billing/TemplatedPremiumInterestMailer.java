package com.javier.closetapp.billing;

import com.javier.closetapp.auth.mail.MailTransport;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnExpression;
import org.springframework.stereotype.Component;

// The real notification (app.mail.mode = smtp or relay), sent to the owner's contact address through the same MailTransport as the other
// emails. The body is only the total so far.
@Component
@ConditionalOnExpression("'${app.mail.mode:log}' == 'smtp' or '${app.mail.mode:log}' == 'relay'")
public class TemplatedPremiumInterestMailer implements PremiumInterestMailer {

    private final MailTransport transport;
    private final String contactEmail;

    public TemplatedPremiumInterestMailer(MailTransport transport, @Value("${app.brand.contact-email}") String contactEmail) {
        this.transport = transport;
        this.contactEmail = contactEmail;
    }

    @Override
    public void notifyNewRequest(long userId, long totalRequests) {
        String text = "Someone requested Premium on VYSVI.\n\nTotal requests so far: " + totalRequests + "\n";
        String html = "<p>Someone requested Premium on VYSVI.</p><p>Total requests so far: <strong>" + totalRequests + "</strong></p>";
        transport.send(contactEmail, contactEmail, "New Premium request", text, html);
    }
}
