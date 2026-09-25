package com.javier.closetapp.auth.mail;

import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.io.ClassPathResource;
import org.springframework.mail.MailException;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Component;
import org.springframework.util.StreamUtils;
import org.springframework.web.util.HtmlUtils;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.Year;

// Real delivery over SMTP. Active when app.mail.mode=smtp; the SMTP account
// itself is configured with the standard spring.mail.* properties (host, port,
// username, password) - see application-local.properties.example.
//
// The HTML body is the branded template at resources/mail/password-reset.html
// (VYSVI's graphite/silver look, table layout with inline styles because that
// is what email clients reliably support). Every value substituted into it is
// HTML-escaped.
@Component
@ConditionalOnProperty(prefix = "app.mail", name = "mode", havingValue = "smtp")
public class SmtpPasswordResetMailer implements PasswordResetMailer {

    private final JavaMailSender mailSender;
    private final String from;
    private final long expirationMinutes;
    private final String ownerName;
    private final String ownerTitle;
    private final String contactEmail;
    private final String htmlTemplate;

    public SmtpPasswordResetMailer(JavaMailSender mailSender,
                                   @Value("${app.mail.from}") String from,
                                   @Value("${app.password-reset.expiration-minutes:30}") long expirationMinutes,
                                   @Value("${app.brand.owner-name}") String ownerName,
                                   @Value("${app.brand.owner-title}") String ownerTitle,
                                   @Value("${app.brand.contact-email}") String contactEmail) {
        this.mailSender = mailSender;
        this.from = from;
        this.expirationMinutes = expirationMinutes;
        this.ownerName = ownerName;
        this.ownerTitle = ownerTitle;
        this.contactEmail = contactEmail;
        this.htmlTemplate = loadTemplate();
    }

    @Override
    public void sendPasswordResetLink(String toEmail, String resetLink) {
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
            helper.setFrom(from);
            helper.setTo(toEmail);
            helper.setReplyTo(contactEmail);
            helper.setSubject("Reset your VYSVI password");
            helper.setText(buildText(resetLink), buildHtml(toEmail, resetLink));
            mailSender.send(message);
        } catch (MessagingException | MailException e) {
            // Rethrown unchecked so PasswordResetService logs it (and still
            // answers the request identically - it never reveals mail failures).
            throw new IllegalStateException("Failed to send password reset email", e);
        }
    }

    private String buildHtml(String toEmail, String resetLink) {
        return htmlTemplate
                .replace("{{RESET_LINK}}", HtmlUtils.htmlEscape(resetLink))
                .replace("{{RECIPIENT}}", HtmlUtils.htmlEscape(toEmail))
                .replace("{{EXPIRES}}", String.valueOf(expirationMinutes))
                .replace("{{OWNER_NAME}}", HtmlUtils.htmlEscape(ownerName))
                .replace("{{OWNER_TITLE}}", HtmlUtils.htmlEscape(ownerTitle))
                .replace("{{CONTACT_EMAIL}}", HtmlUtils.htmlEscape(contactEmail))
                .replace("{{YEAR}}", String.valueOf(Year.now().getValue()));
    }

    // Plain-text alternative, for clients that don't render HTML.
    private String buildText(String resetLink) {
        return "Someone (hopefully you) asked to reset the password for your VYSVI account.\n\n"
                + "Choose a new password here (the link works once and expires in " + expirationMinutes + " minutes):\n"
                + resetLink + "\n\n"
                + "If you didn't ask for this, you can ignore this email - your password won't change.\n\n"
                + "-- \n"
                + ownerName + "\n"
                + ownerTitle + "\n"
                + "Questions? " + contactEmail + "\n";
    }

    private static String loadTemplate() {
        try {
            return StreamUtils.copyToString(new ClassPathResource("mail/password-reset.html").getInputStream(),
                    StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new IllegalStateException("Could not load the password reset email template", e);
        }
    }
}
