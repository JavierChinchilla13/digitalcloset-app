package com.javier.closetapp.auth.mail;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.mail.javamail.JavaMailSender;

import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.assertj.core.api.Assertions.assertThat;

// Task 94: app.mail.mode picks which mailers and which transport exist, and the
// templated mailers hand a fully built email to the transport.
class MailModesTest {

    private static final String[] BRAND = {
            "app.brand.owner-name=Ada", "app.brand.owner-title=Creator", "app.brand.contact-email=owner@example.com",
            "app.mail.from=noreply@example.com"
    };

    private ApplicationContextRunner runner() {
        return new ApplicationContextRunner()
                .withUserConfiguration(SmtpMailTransport.class, AppsScriptMailTransport.class,
                        TemplatedPasswordResetMailer.class, TemplatedVerificationCodeMailer.class,
                        LoggingPasswordResetMailer.class, LoggingVerificationCodeMailer.class)
                .withBean(JavaMailSender.class, () -> Mockito.mock(JavaMailSender.class))
                .withPropertyValues(BRAND);
    }

    @Test
    @DisplayName("log mode (the default) uses the console mailers and no transport")
    void logMode() {
        runner().run(context -> {
            assertThat(context).hasSingleBean(LoggingPasswordResetMailer.class);
            assertThat(context).hasSingleBean(LoggingVerificationCodeMailer.class);
            assertThat(context).doesNotHaveBean(MailTransport.class);
            assertThat(context).doesNotHaveBean(TemplatedPasswordResetMailer.class);
        });
    }

    @Test
    @DisplayName("smtp mode uses the templated mailers over the SMTP transport")
    void smtpMode() {
        runner().withPropertyValues("app.mail.mode=smtp").run(context -> {
            assertThat(context).hasSingleBean(SmtpMailTransport.class);
            assertThat(context).doesNotHaveBean(AppsScriptMailTransport.class);
            assertThat(context).hasSingleBean(TemplatedPasswordResetMailer.class);
            assertThat(context).hasSingleBean(TemplatedVerificationCodeMailer.class);
            assertThat(context).doesNotHaveBean(LoggingPasswordResetMailer.class);
        });
    }

    @Test
    @DisplayName("relay mode uses the templated mailers over the Apps Script transport")
    void relayMode() {
        runner().withPropertyValues("app.mail.mode=relay",
                "app.mail.relay.url=https://script.google.com/macros/s/x/exec", "app.mail.relay.secret=abc").run(context -> {
            assertThat(context).hasSingleBean(AppsScriptMailTransport.class);
            assertThat(context).doesNotHaveBean(SmtpMailTransport.class);
            assertThat(context).hasSingleBean(TemplatedPasswordResetMailer.class);
            assertThat(context).hasSingleBean(TemplatedVerificationCodeMailer.class);
            assertThat(context).doesNotHaveBean(LoggingVerificationCodeMailer.class);
        });
    }

    @Test
    @DisplayName("relay mode without its URL and secret fails at startup, not at the first email")
    void relayModeNeedsItsSettings() {
        runner().withPropertyValues("app.mail.mode=relay").run(context -> assertThat(context).hasFailed());
    }

    // ---- what the templated mailers hand to the transport

    private record Sent(String to, String replyTo, String subject, String text, String html) {}

    @Test
    @DisplayName("the reset email carries the link in both parts, HTML-escaped in the HTML, replies to the owner")
    void resetEmail() {
        List<Sent> sent = new ArrayList<>();
        MailTransport capture = (to, replyTo, subject, text, html) -> sent.add(new Sent(to, replyTo, subject, text, html));
        TemplatedPasswordResetMailer mailer =
                new TemplatedPasswordResetMailer(capture, 30, "Ada", "Creator", "owner@example.com");

        mailer.sendPasswordResetLink("ana@example.com", "https://site.test/reset-password?token=a&b=c");

        assertEquals(1, sent.size());
        Sent mail = sent.get(0);
        assertEquals("ana@example.com", mail.to());
        assertEquals("owner@example.com", mail.replyTo());
        assertEquals("Reset your VYSVI password", mail.subject());
        assertTrue(mail.text().contains("https://site.test/reset-password?token=a&b=c"));
        assertTrue(mail.html().contains("token=a&amp;b=c"));
    }

    @Test
    @DisplayName("the verification emails carry the code and say what it is for")
    void verificationEmails() {
        List<Sent> sent = new ArrayList<>();
        MailTransport capture = (to, replyTo, subject, text, html) -> sent.add(new Sent(to, replyTo, subject, text, html));
        TemplatedVerificationCodeMailer mailer =
                new TemplatedVerificationCodeMailer(capture, 10, "Ada", "Creator", "owner@example.com");

        mailer.sendEmailChangeCode("ana@example.com", "123456");
        mailer.sendPasswordChangeCode("ana@example.com", "654321");

        assertEquals(2, sent.size());
        assertEquals("Your VYSVI verification code", sent.get(0).subject());
        assertTrue(sent.get(0).text().contains("123456"));
        assertTrue(sent.get(0).html().contains("123456"));
        assertTrue(sent.get(0).text().contains("confirm your new email address"));
        assertTrue(sent.get(1).text().contains("654321"));
        assertTrue(sent.get(1).text().contains("change the password"));
    }

    @Test
    @DisplayName("a transport failure reaches the caller (which logs it) instead of being swallowed")
    void failurePropagates() {
        MailTransport failing = (to, replyTo, subject, text, html) -> {
            throw new IllegalStateException("boom");
        };
        TemplatedPasswordResetMailer mailer =
                new TemplatedPasswordResetMailer(failing, 30, "Ada", "Creator", "owner@example.com");

        org.junit.jupiter.api.Assertions.assertThrows(IllegalStateException.class,
                () -> mailer.sendPasswordResetLink("ana@example.com", "https://site.test/x"));
    }
}
