package com.javier.closetapp.auth.mail;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnExpression;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;
import org.springframework.util.StreamUtils;
import org.springframework.web.util.HtmlUtils;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.Year;

// The real verification-code email (app.mail.mode = smtp or relay), mirroring
// TemplatedPasswordResetMailer: delivery is the MailTransport's business. The
// HTML body is the branded template at resources/mail/verification-code.html,
// with {{PURPOSE_*}} filled in per call so one template serves both an email
// change and a password change.
@Component
@ConditionalOnExpression("'${app.mail.mode:log}' == 'smtp' or '${app.mail.mode:log}' == 'relay'")
public class TemplatedVerificationCodeMailer implements VerificationCodeMailer {

    private final MailTransport transport;
    private final long expirationMinutes;
    private final String ownerName;
    private final String ownerTitle;
    private final String contactEmail;
    private final String htmlTemplate;

    public TemplatedVerificationCodeMailer(MailTransport transport,
                                      @Value("${app.account-verification.expiration-minutes:10}") long expirationMinutes,
                                      @Value("${app.brand.owner-name}") String ownerName,
                                      @Value("${app.brand.owner-title}") String ownerTitle,
                                      @Value("${app.brand.contact-email}") String contactEmail) {
        this.transport = transport;
        this.expirationMinutes = expirationMinutes;
        this.ownerName = ownerName;
        this.ownerTitle = ownerTitle;
        this.contactEmail = contactEmail;
        this.htmlTemplate = loadTemplate();
    }

    @Override
    public void sendEmailChangeCode(String toEmail, String code) {
        send(toEmail, code, "Email change", "confirm your new email address", "email change");
    }

    @Override
    public void sendPasswordChangeCode(String toEmail, String code) {
        send(toEmail, code, "Password change", "asked to change the password", "password change");
    }

    private void send(String toEmail, String code, String purposeLabel, String purposeBody, String purposeLabelLower) {
        // A failure is thrown unchecked so the caller logs it.
        transport.send(toEmail, contactEmail, "Your VYSVI verification code",
                buildText(code, purposeBody), buildHtml(toEmail, code, purposeLabel, purposeBody, purposeLabelLower));
    }

    private String buildHtml(String toEmail, String code, String purposeLabel, String purposeBody, String purposeLabelLower) {
        return htmlTemplate
                .replace("{{CODE}}", HtmlUtils.htmlEscape(code))
                .replace("{{RECIPIENT}}", HtmlUtils.htmlEscape(toEmail))
                .replace("{{EXPIRES}}", String.valueOf(expirationMinutes))
                .replace("{{PURPOSE_LABEL}}", HtmlUtils.htmlEscape(purposeLabel))
                .replace("{{PURPOSE_LABEL_LOWER}}", HtmlUtils.htmlEscape(purposeLabelLower))
                .replace("{{PURPOSE_TITLE}}", HtmlUtils.htmlEscape("Confirm your " + purposeLabelLower))
                .replace("{{PURPOSE_BODY}}", HtmlUtils.htmlEscape(purposeBody))
                .replace("{{OWNER_NAME}}", HtmlUtils.htmlEscape(ownerName))
                .replace("{{OWNER_TITLE}}", HtmlUtils.htmlEscape(ownerTitle))
                .replace("{{CONTACT_EMAIL}}", HtmlUtils.htmlEscape(contactEmail))
                .replace("{{YEAR}}", String.valueOf(Year.now().getValue()));
    }

    // Plain-text alternative, for clients that don't render HTML.
    private String buildText(String code, String purposeBody) {
        return "Someone (hopefully you) " + purposeBody + " for your VYSVI account.\n\n"
                + "Your verification code (works once, expires in " + expirationMinutes + " minutes):\n"
                + code + "\n\n"
                + "If you didn't ask for this, you can ignore this email - nothing will change.\n\n"
                + "-- \n"
                + ownerName + "\n"
                + ownerTitle + "\n"
                + "Questions? " + contactEmail + "\n";
    }

    private static String loadTemplate() {
        try {
            return StreamUtils.copyToString(new ClassPathResource("mail/verification-code.html").getInputStream(),
                    StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new IllegalStateException("Could not load the verification code email template", e);
        }
    }
}
