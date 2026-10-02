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

// Real delivery over SMTP, mirroring SmtpPasswordResetMailer exactly (same
// account config, same @ConditionalOnProperty on app.mail.mode=smtp). The
// HTML body is the branded template at resources/mail/verification-code.html,
// with {{PURPOSE_*}} filled in per call so one template serves both an email
// change and a password change.
@Component
@ConditionalOnProperty(prefix = "app.mail", name = "mode", havingValue = "smtp")
public class SmtpVerificationCodeMailer implements VerificationCodeMailer {

    private final JavaMailSender mailSender;
    private final String from;
    private final long expirationMinutes;
    private final String ownerName;
    private final String ownerTitle;
    private final String contactEmail;
    private final String htmlTemplate;

    public SmtpVerificationCodeMailer(JavaMailSender mailSender,
                                      @Value("${app.mail.from}") String from,
                                      @Value("${app.account-verification.expiration-minutes:10}") long expirationMinutes,
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
    public void sendEmailChangeCode(String toEmail, String code) {
        send(toEmail, code, "Email change", "confirm your new email address", "email change");
    }

    @Override
    public void sendPasswordChangeCode(String toEmail, String code) {
        send(toEmail, code, "Password change", "asked to change the password", "password change");
    }

    private void send(String toEmail, String code, String purposeLabel, String purposeBody, String purposeLabelLower) {
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
            helper.setFrom(from);
            helper.setTo(toEmail);
            helper.setReplyTo(contactEmail);
            helper.setSubject("Your VYSVI verification code");
            helper.setText(buildText(code, purposeBody), buildHtml(toEmail, code, purposeLabel, purposeBody, purposeLabelLower));
            mailSender.send(message);
        } catch (MessagingException | MailException e) {
            // Rethrown unchecked so the caller logs it - matches
            // SmtpPasswordResetMailer.
            throw new IllegalStateException("Failed to send verification code email", e);
        }
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
