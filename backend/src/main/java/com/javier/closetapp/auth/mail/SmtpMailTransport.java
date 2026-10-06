package com.javier.closetapp.auth.mail;

import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.mail.MailException;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Component;

// Real delivery over SMTP. Active when app.mail.mode=smtp; the SMTP account
// itself is configured with the standard spring.mail.* properties (host, port,
// username, password) - see application-local.properties.example.
@Component
@ConditionalOnProperty(prefix = "app.mail", name = "mode", havingValue = "smtp")
public class SmtpMailTransport implements MailTransport {

    private final JavaMailSender mailSender;
    private final String from;

    public SmtpMailTransport(JavaMailSender mailSender, @Value("${app.mail.from}") String from) {
        this.mailSender = mailSender;
        this.from = from;
    }

    @Override
    public void send(String toEmail, String replyTo, String subject, String text, String html) {
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
            helper.setFrom(from);
            helper.setTo(toEmail);
            helper.setReplyTo(replyTo);
            helper.setSubject(subject);
            helper.setText(text, html);
            mailSender.send(message);
        } catch (MessagingException | MailException e) {
            // Unchecked, so the caller logs it (and still answers the request
            // identically - it never reveals mail failures).
            throw new IllegalStateException("Failed to send email over SMTP", e);
        }
    }
}
